import { createGptClient } from '..'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('parseResponse', () => {
  it('should support parsing JSON', async () => {
    const testResponse = {
      choices: [
        {
          text: JSON.stringify({
            foo: 1,
            bar: 2,
            baz: ['quux'],
          }),
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

    const gptClient = createGptClient({
      modelId: 'gpt-4',
      parseResponse: (response): ExampleType => {
        return JSON.parse(response.choices[0].text)
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

  it.todo('should support throwing with feedback for model and retrying')

  it.todo(
    'should support throwing with feedback for model and retrying with max retries',
  )
})
