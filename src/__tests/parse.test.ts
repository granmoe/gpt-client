import { createChatClient } from '..'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { CreateCompletionResponse } from '../openai-types'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('parse', () => {
  it('supports parsing JSON', async () => {
    const testResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              foo: 1,
              bar: 2,
              baz: ['quux'],
            }),
          },
        },
      ],
    }

    server.use(
      rest.post('*', (_req, res, ctx) => {
        return res(ctx.json(testResponse))
      }),
    )

    type ExampleType = {
      foo: number
      bar: number
      baz: string[]
    }

    const gptClient = createChatClient({
      modelId: 'gpt-4',
      parse: (response): ExampleType => {
        return JSON.parse(response.choices[0].message.content ?? '')
      },
    })

    const result = await gptClient.fetchCompletion({
      messages: [
        {
          role: 'user',
          content: 'Test content',
        },
      ],
    })

    expect(result).toEqual({
      foo: 1,
      bar: 2,
      baz: ['quux'],
    })
  })

  it('supports retrying with feedback while under max retries (default of 2)', async () => {
    const testResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              foo: 1,
              bar: 2,
              baz: ['quux'],
            }),
          },
        },
      ],
    }

    let callCount = 0

    server.use(
      rest.post('*', (_req, res, ctx) => {
        if (callCount < 2) {
          callCount++

          return res(
            ctx.json({
              choices: [
                {
                  text: 'This will blow up JSON.parse',
                },
              ],
            }),
          )
        }

        return res(ctx.json(testResponse))
      }),
    )

    type ExampleType = {
      foo: number
      bar: number
      baz: string[]
    }

    const gptClient = createChatClient<ExampleType>({
      modelId: 'gpt-4',
      parse: async (response: CreateCompletionResponse, retry) => {
        try {
          const json = JSON.parse(response.choices[0].message.content ?? '')
          return json as ExampleType
        } catch (error) {
          return retry({
            feedback:
              'Hey, GPT-4! Please return the output in the right format!',
            updatedModelParams: {
              temperature: 0,
            },
          })
        }
      },
    })

    const result = await gptClient.fetchCompletion({
      messages: [
        {
          role: 'user',
          content: 'Test content',
        },
      ],
    })

    expect(result).toEqual({
      foo: 1,
      bar: 2,
      baz: ['quux'],
    })
  })
})
