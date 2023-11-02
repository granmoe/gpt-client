import {
  createChatClient,
  ChatCompletionMessageParam,
} from '../create-chat-client'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

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
                message: {
                  role: 'assistant',
                  content: 'This is a test response',
                },
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

    const messages: ChatCompletionMessageParam[] = [
      MESSAGE_WITH_8192_TOKENS,
      {
        role: 'user',
        content: 'This is a normal message',
      },
    ]

    const result = await gptClient.createCompletion({
      messages,
    })

    expect(requestMessages).toEqual(messages.slice(1))
    expect(result).toBe('This is a test response')
  })

  it('takes into account minResponseTokens if passed', async () => {
    let requestMessages

    server.use(
      rest.post('*', async (req, res, ctx) => {
        requestMessages = (await req?.json()).messages
        return res(
          ctx.json({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'This is a test response',
                },
              },
            ],
          }),
        )
      }),
    )

    const gptClient = createChatClient({
      modelId: 'gpt-3.5-turbo',
      trimTokens: (messages, _overage) => messages.slice(1), // Drop oldest message
      minResponseTokens: 3098,
    })

    // Since gpt-3.5-turbo allows 4097 tokens, and we have min response tokens of 3097, we have 999 left to work with
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: SINGLE_TOKEN_WORD.repeat(100 - 6),
      },
      {
        role: 'user',
        content: SINGLE_TOKEN_WORD.repeat(900 - 6),
      },
    ]

    // Our trim tokens strategy will drop the oldest messages
    // so we should end up calling OpenAI with just the second message and get a successful response

    const result = await gptClient.createCompletion({
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
                message: {
                  role: 'assistant',
                  content: 'This is a test response',
                },
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

    const messages: ChatCompletionMessageParam[] = [
      MESSAGE_WITH_8192_TOKENS,
      MESSAGE_WITH_8192_TOKENS,
    ]

    await expect(
      gptClient.createCompletion({
        messages,
      }),
    ).rejects.toThrow(
      /Token count \(\d+\) exceeds max tokens per request \(8192\)/,
    )
  })

  it('throws an error when messages still exceed the token limit even after trimming, taking into account minResponseTokens', async () => {
    server.use(
      rest.post('*', (_req, res, ctx) => {
        return res(
          ctx.json({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'This is a test response',
                },
              },
            ],
          }),
        )
      }),
    )

    const gptClient = createChatClient({
      modelId: 'gpt-4',
      trimTokens: (messages, _overage) => {
        if (messages.length > 1) {
          return messages.slice(1)
        }

        return messages
      },
      minResponseTokens: 6000,
    })

    const messages: ChatCompletionMessageParam[] = [MESSAGE_WITH_8192_TOKENS]

    await expect(
      gptClient.createCompletion({
        messages,
      }),
    ).rejects.toThrow(
      /Token count \(\d+\) exceeds max tokens per request \(8192\)/,
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
                  message: {
                    role: 'assistant',
                    content: 'This is a test response',
                  },
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

    const messages: ChatCompletionMessageParam[] = [
      MESSAGE_WITH_8192_TOKENS,
      MESSAGE_WITH_8192_TOKENS,
    ]

    await expect(
      gptClient.createCompletion({
        messages,
      }),
    ).rejects.toThrow('400 status code (no body)')
  })
})

const SINGLE_TOKEN_WORD = 'hey'

// The formatting takes up 7 tokens
const MESSAGE_WITH_8192_TOKENS: ChatCompletionMessageParam = {
  role: 'user',
  content: 'hey' + SINGLE_TOKEN_WORD.repeat(8185),
}
