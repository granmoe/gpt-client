import { createChatClient } from '..'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { ChatCompletionRequestMessage } from '../openai-types'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('trimTokens', () => {
  it('trims messages when token count exceeds maximum allowed for the model', async () => {
    let requestMessages

    server.use(
      rest.post('*', async (req, res, ctx) => {
        requestMessages = (await req?.json()).messages
        return res(
          ctx.json({
            choices: [
              {
                text: 'This is a test response',
              },
            ],
          }),
        )
      }),
    )

    const gptClient = createChatClient({
      modelId: 'gpt-4',
      trimTokens: (messages, _overage) => messages.slice(1), // Drop first message
    })

    const messages: ChatCompletionRequestMessage[] = [
      messageLongerThanMaxTokens,
      {
        role: 'user',
        content: 'This is a normal message',
      },
    ]

    const result = await gptClient.fetchCompletion({
      messages,
    })

    expect(requestMessages).toEqual(messages.slice(1))
    expect(result).toBe('This is a test response')
  })

  it('throws an error when messages still exceed the token limit even after trimming', async () => {
    server.use(
      rest.post('*', (_req, res, ctx) => {
        return res(
          ctx.json({
            choices: [
              {
                text: 'This is a test response',
              },
            ],
          }),
        )
      }),
    )

    const gptClient = createChatClient({
      modelId: 'gpt-4',
      trimTokens: (messages, _overage) => messages, // don't drop any tokens
    })

    const messages: ChatCompletionRequestMessage[] = [
      messageLongerThanMaxTokens,
      messageLongerThanMaxTokens,
    ]

    await expect(
      gptClient.fetchCompletion({
        messages,
      }),
    ).rejects.toThrow(
      'Token count (16399) exceeds max tokens per request (8192)',
    )
  })

  it('messages are not trimmed if trimTokens is not passed', async () => {
    server.use(
      rest.post('*', async (req, res, ctx) => {
        const requestJson = await req.json()
        if ((requestJson.messages ?? []).length > 1) {
          return res(ctx.status(400))
        } else {
          // Shouldn't get here
          return res(
            ctx.json({
              choices: [
                {
                  text: 'This is a test response',
                },
              ],
            }),
          )
        }
      }),
    )

    const gptClient = createChatClient({
      modelId: 'gpt-4',
    })

    const messages: ChatCompletionRequestMessage[] = [
      messageLongerThanMaxTokens,
      messageLongerThanMaxTokens,
    ]

    await expect(
      gptClient.fetchCompletion({
        messages,
      }),
    ).rejects.toThrow('Request failed with status code 400')
  })
})

const messageLongerThanMaxTokens: ChatCompletionRequestMessage = {
  role: 'user',
  content: 'a'.repeat(4 * 8192), // ~4 chars per token, max tokens of 8192 for GPT-4
}
