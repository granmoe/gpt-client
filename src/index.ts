import axios, { AxiosError } from 'axios'
import axiosRetry from 'axios-retry'

export const createGptClient = <
  TParsedResponse extends (response: OpenAIResponse) => any = DefaultParser,
>(
  params: CreateGptClientParams<TParsedResponse>,
) => {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    modelId,
    modelDefaultParams = {
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    },
    parseResponse = (response: OpenAIResponse) => response.choices[0].text,
    retryStrategy,
  } = params

  if (!apiKey) {
    throw new Error(
      'OpenAI API key is required. You must either pass apiKey or set the OPENAI_API_KEY environment variable.',
    )
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  axiosRetry(axiosInstance, {
    retries: retryStrategy?.maxRetries ?? 2,
    shouldResetTimeout: true,
    retryDelay: (retryCount) => {
      // Return time to delay in milliseconds
      return retryStrategy?.calculateDelay
        ? retryStrategy.calculateDelay(retryCount)
        : 2 ** retryCount * 1000 + // Exponential backoff: 1 second, then 2, 4, 8 etc
            (Math.floor(Math.random() * 50) + 1) // Additional random delay between 1 and 50 ms
    },
    retryCondition: (error) => {
      return retryStrategy?.shouldRetry
        ? retryStrategy.shouldRetry(error)
        : error.response?.status === 429
    },
  })

  const fetchCompletion = async (request: {
    messages: ChatMessage[]
    modelParams?: ModelParams
  }): Promise<ReturnType<TParsedResponse>> => {
    const { messages, modelParams } = request

    const { data } = await axiosInstance.post(OPENAI_CHAT_COMPLETIONS_URL, {
      model: modelId,
      messages,
      ...modelDefaultParams,
      ...modelParams,
    })

    if (data.choices.length === 0) {
      throw new Error('No response from OpenAI')
    }

    return parseResponse(data)
  }

  return {
    fetchCompletion,
  }
}

export type OpenAIResponse = {
  id: string
  object: string
  created: number
  model: string
  usage: {
    total_tokens: number
    prompt_tokens: number
    completion_tokens: number
    total_completions: number
  }
  choices: {
    text: string
    index: number
    // logprobs: null // TODO
    finish_reason: string
  }[]
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type CreateGptClientParams<TParseResponse = DefaultParser> = {
  apiKey?: string
  modelId: 'gpt-3' | 'gpt-4' | 'gpt-3.5' | 'gpt-4-32k'
  modelDefaultParams?: ModelParams
  parseResponse?: TParseResponse
  retryStrategy?: {
    shouldRetry?: (error: AxiosError) => boolean
    calculateDelay?: (retryCount: number) => number
    maxRetries?: number
    updateModelParams?: (modelParams: any) => any
  }
}

export type RetryStrategy = CreateGptClientParams['retryStrategy']

export type ModelParams = {
  max_tokens?: number
  temperature?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
}

type DefaultParser = (response: OpenAIResponse) => string

// Example usage:
// const gptClient = createGptClient({
//   modelId: 'gpt-4',
//   parseResponse: (response) => {
//     return response.choices[0].text === 'test' ? 1 : 0
//   },
// })

// const main = async () => {
//   const test = await gptClient.fetchCompletion({
//     messages: [
//       {
//         role: 'user',
//         content: 'Hello, how are you?',
//       },
//     ],
//   })
// }

// const MAX_GPT_4_TOKENS = 8192

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
