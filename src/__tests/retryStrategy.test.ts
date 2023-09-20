import { RetryStrategy, createGptClient } from '..'
import { ChatCompletionRequestMessage } from '../openai-types'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Retry', () => {
  it('should retry on status >= 400 by default', async () => {
    const successResponse = {
      choices: [{ text: 'Test response' }],
    }

    let callCount = 0
    let httpStatuses = [400, 401, 429, 500, 502]

    server.use(
      rest.post('*', (_req, res, ctx) => {
        if (callCount < httpStatuses.length - 1) {
          callCount++
          return res(ctx.status(httpStatuses[callCount]))
        }

        return res(ctx.json(successResponse))
      }),
    )

    const gptClient = createGptClient({
      modelId: 'gpt-4',
      retryStrategy: {
        maxRetries: 5,
      },
    })

    const result = await gptClient.fetchCompletion({
      messages: mockMessages,
    })

    expect(result).toEqual(successResponse.choices[0].text)
  })

  it('should retry with custom strategy', async () => {
    const successResponse = {
      choices: [{ text: 'Test response' }],
    }

    let callCount = 0

    server.use(
      rest.post('*', (_req, res, ctx) => {
        if (callCount < 2) {
          callCount++
          return res(ctx.status(500))
        }

        return res(ctx.json(successResponse))
      }),
    )

    const retryStrategy: RetryStrategy = {
      shouldRetry: (error) => error.response?.status === 500,
      calculateDelay: (retryCount) => 1000 * Math.max(retryCount, 1),
      maxRetries: 2,
    }

    const gptClient = createGptClient({
      modelId: 'gpt-4',
      retryStrategy,
    })

    const result = await gptClient.fetchCompletion({
      messages: mockMessages,
    })

    expect(result).toBe(successResponse.choices[0].text)
  })

  it('should fail after max retries exceeded', async () => {
    server.use(
      rest.post('*', (_req, res, ctx) => {
        return res(ctx.status(429))
      }),
    )

    const gptClient = createGptClient({
      modelId: 'gpt-4',
      retryStrategy: {
        maxRetries: 1,
      },
    })

    const result = gptClient.fetchCompletion({
      messages: mockMessages,
    })

    await expect(result).rejects.toThrow()
  })
})

const mockMessages: ChatCompletionRequestMessage[] = [
  {
    role: 'user',
    content: 'Test content',
  },
]