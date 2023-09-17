import axios, { AxiosError } from 'axios'
import axiosRetry from 'axios-retry'

export const createGptClient = <T = string>(
  params: CreateGptClientParams<T>,
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
    minResponseTokens,
    parseResponse = (response: OpenAIResponse) =>
      // response.choices[0].text as unknown as T,
      response.choices[0].text,
    handleTokenLimitExceeded,
    retryStrategy,
  } = params

  if (!apiKey) {
    throw new Error(
      'OpenAI API key is required. You must either pass apiKey or set the OPENAI_API_KEY environment variable.',
    )
  }

  const instance = axios.create({
    baseURL: 'https://api.openai.com/v1/',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  // Set axios-retry config
  axiosRetry(instance, {
    retries: retryStrategy?.maxRetries || 2,
    shouldResetTimeout: true,
    retryDelay: (retryCount) => {
      return (
        retryStrategy?.calculateDelay(retryCount) ||
        Math.random() * 20 * 2 ** retryCount // TODO: Fix this
      )
    },
    retryCondition: (error) => {
      return retryStrategy?.shouldRetry(error) || false
    },
  })

  const fetchCompletion = async (request: {
    messages: ChatMessage[]
    modelParams?: {
      temperature?: number
      top_p?: number
      frequency_penalty?: number
      presence_penalty?: number
    }
  }) => {
    const { messages, modelParams } = request

    const response = await instance.post<OpenAIResponse>(
      `davinci/${modelId}/completions`,
      {
        messages,
        ...modelDefaultParams,
        ...modelParams,
      },
    )

    if (parseResponse) {
      return parseResponse(response.data)
    } else {
      const { choices } = response.data

      if (choices.length === 0) {
        throw new Error('No response from OpenAI')
      }

      return choices[0].text
    }
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

export type CreateGptClientParams<T = any> = {
  apiKey?: string
  modelId: 'gpt-3' | 'gpt-4' | 'gpt-3.5' | 'gpt-4-32k'
  modelDefaultParams?: {
    temperature?: number
    top_p?: number
    frequency_penalty?: number
    presence_penalty?: number
  }
  minResponseTokens?: number
  parseResponse?: (response: OpenAIResponse) => T
  handleTokenLimitExceeded?: (messages: ChatMessage[]) => ChatMessage[] | false
  retryStrategy?: {
    shouldRetry: (error: AxiosError) => boolean
    calculateDelay: (retryCount: number) => number
    maxRetries: number
    updateModelParams?: (modelParams: any) => any
  }
}
