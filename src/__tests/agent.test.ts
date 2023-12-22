import { z } from 'zod'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import OpenAI from 'openai'

import { createAgent } from '../agent'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Agent', () => {
  describe('returns valid, statically typed tool calls matching passed in schemas', () => {
    it('single tool agent', async () => {
      const testResponse: OpenAI.ChatCompletion = {
        id: '123',
        created: 123,
        model: 'gpt-4',
        object: 'chat.completion',
        choices: [
          {
            finish_reason: 'stop',
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: '123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: JSON.stringify({
                      location: 'London',
                    }),
                  },
                },
              ],
            },
          },
        ],
      }

      server.use(
        rest.post('*', (_req, res, ctx) => {
          return res(ctx.json(testResponse))
        }),
      )

      const tools = [
        {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          schema: z.object({
            location: z.string(),
          }),
        },
      ]

      const agent = createAgent({ tools })

      const { toolCalls, invalidToolCalls, message } =
        await agent.runConversation({
          messages: [
            {
              role: 'user',
              content: 'What is the weather like in London?',
            },
          ],
        })

      expect(toolCalls).toHaveLength(1)
      expect(invalidToolCalls).toHaveLength(0)
      expect(message).toBe(null)

      for (const toolCall of toolCalls) {
        if (toolCall.name === 'get_weather') {
          expect(toolCall.id).toBe('123')
          expect(Object.keys(toolCall.arguments)).toHaveLength(1)
          expect(toolCall.arguments.location).toBe('London')
        }
      }
    })

    it('multiple tool agent', async () => {
      const testResponse: OpenAI.ChatCompletion = {
        id: '123',
        created: 123,
        model: 'gpt-4',
        object: 'chat.completion',
        choices: [
          {
            finish_reason: 'stop',
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: '123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: JSON.stringify({
                      location: 'Barcelona',
                    }),
                  },
                },
                {
                  id: '456',
                  type: 'function',
                  function: {
                    name: 'buy_stock',
                    arguments: JSON.stringify({
                      symbol: 'TEAM',
                      shares: 1000000,
                    }),
                  },
                },
              ],
            },
          },
        ],
      }

      server.use(
        rest.post('*', (_req, res, ctx) => {
          return res(ctx.json(testResponse))
        }),
      )

      const tools = [
        {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          schema: z.object({
            location: z.string(),
          }),
        },
        {
          name: 'buy_stock',
          description: 'Buy a stock',
          schema: z.object({
            symbol: z.string(),
            shares: z.number(),
          }),
        },
      ] as const

      const agent = createAgent({ tools })

      const { toolCalls, invalidToolCalls, message } =
        await agent.runConversation({
          messages: [
            {
              role: 'user',
              content: 'What is the weather like in London?',
            },
          ],
        })

      expect(invalidToolCalls).toHaveLength(0)
      expect(toolCalls).toHaveLength(2)
      expect(message).toBe(null)

      for (const toolCall of toolCalls) {
        if (toolCall.name === 'get_weather') {
          expect(Object.keys(toolCall.arguments)).toHaveLength(1)
          expect(toolCall.arguments.location).toBe('Barcelona')
        } else if (toolCall.name === 'buy_stock') {
          expect(Object.keys(toolCall.arguments)).toHaveLength(2)
          expect(toolCall.arguments.symbol).toBe('TEAM')
          expect(toolCall.arguments.shares).toBe(1000000)
        }
      }
    })
  })

  it('correctly infers types when override tools are passed in for a call', async () => {
    const testResponse: OpenAI.ChatCompletion = {
      id: '123',
      created: 123,
      model: 'gpt-4',
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: '456',
                type: 'function',
                function: {
                  name: 'buy_stock',
                  arguments: JSON.stringify({
                    symbol: 'TEAM',
                    shares: 100,
                  }),
                },
              },
            ],
          },
        },
      ],
    }

    server.use(
      rest.post('*', (_req, res, ctx) => {
        return res(ctx.json(testResponse))
      }),
    )

    const tools = [
      {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        schema: z.object({
          location: z.string(),
        }),
      },
    ] as const

    const agent = createAgent({ tools })

    const otherTools = [
      {
        name: 'buy_stock',
        description: 'Buy a stock',
        schema: z.object({
          symbol: z.string(),
          shares: z.number(),
        }),
      },
    ] as const

    const { toolCalls, invalidToolCalls, message } =
      await agent.runConversation({
        messages: [
          {
            role: 'user',
            content: `Please buy 100 shares of Atlassian`,
          },
        ],
        // Override tools for this call
        tools: otherTools,
      })

    expect(toolCalls).toHaveLength(1)
    expect(invalidToolCalls).toHaveLength(0)
    expect(message).toBe(null)

    for (const toolCall of toolCalls) {
      if (toolCall.name === 'buy_stock') {
        expect(toolCall.arguments.symbol).toBe('TEAM')
        expect(toolCall.arguments.shares).toBe(100)
      }
    }
  })

  it('returns any invalid tool calls in invalidToolCalls', async () => {
    const testResponse: OpenAI.ChatCompletion = {
      id: '123',
      created: 123,
      model: 'gpt-4',
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: '456',
                type: 'function',
                function: {
                  // Unknown tool
                  name: 'buy_stock',
                  arguments: JSON.stringify({
                    symbol: 'TEAM',
                    shares: 100,
                  }),
                },
              },
              {
                id: '123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: JSON.stringify({
                    // Invalid argument type
                    location: 123,
                  }),
                },
              },
              {
                id: '123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: JSON.stringify({
                    // Unknown argument
                    address: 'London',
                  }),
                },
              },
            ],
          },
        },
      ],
    }

    server.use(
      rest.post('*', (_req, res, ctx) => {
        return res(ctx.json(testResponse))
      }),
    )

    const tools = [
      {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        schema: z.object({
          location: z.string(),
        }),
      },
    ] as const

    const agent = createAgent({ tools })

    const { toolCalls, invalidToolCalls, message } =
      await agent.runConversation({
        messages: [
          {
            role: 'user',
            content: `Please buy 100 shares of Atlassian`,
          },
        ],
      })

    expect(toolCalls).toHaveLength(0)
    expect(invalidToolCalls).toHaveLength(3)
    expect(message).toBe(null)

    for (const invalidToolCall of invalidToolCalls) {
      if (invalidToolCall.function.name === 'buy_stock') {
        // Unknown tool, so no Zod error
        expect(invalidToolCall.error).toBeUndefined()
      } else if (invalidToolCall.function.name === 'get_weather') {
        expect(invalidToolCall.error).toBeDefined()
        expect(invalidToolCall.error).toBeInstanceOf(z.ZodError)
      }
    }
  })
})
