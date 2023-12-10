import { createAgent } from '../agent'
import { z } from 'zod'

describe('Agent type inference', () => {
  it('single tool agent - should infer types correctly based on the tool schemas', async () => {
    const WeatherParamsSchema = z.object({
      location: z.string(),
    })

    const tools = [
      {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        schema: WeatherParamsSchema,
      },
    ]

    const t = WeatherParamsSchema.safeParse(123)
    if (t.success) {
      console.log(t.data.location)
    } else {
      console.log(t.error)
    }

    const agent = createAgent({ tools })

    const result = await agent.runConversation({ messages: ['...'] })

    expect(typeof result[0].args.location).toBe('string')
  })

  it('multiple tool agent - should infer types correctly based on the tool schemas', async () => {
    const WeatherParamsSchema = z.object({
      location: z.string(),
    })

    const PriceHistorySchema = z.array(
      z.object({
        date: z.string(),
        price: z.number(),
      }),
    )

    const otherTools = [
      {
        name: 'buy_stock',
        description: 'Buy a stock',
        schema: z.object({
          stock: z.string(),
          price: z.number(),
        }),
      },
    ] as const

    const tools = [
      {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        schema: WeatherParamsSchema,
      },
      {
        name: 'get_price_history',
        description: 'Get the price history for a product',
        schema: PriceHistorySchema,
      },
    ] as const

    const agent = createAgent({ tools })

    const result = await agent.runConversation({
      messages: [
        {
          role: 'user',
          content: 'What is the weather like in London?',
        },
      ],
    })

    for (const toolCall of result.toolCalls) {
      if (!toolCall.isValid) {
        console.log(toolCall.error)
        return
      }

      if (toolCall.name === 'get_weather') {
        console.log(toolCall.data.location)
      }
    }
  })
})
