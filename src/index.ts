import axios, { AxiosError } from 'axios'
import axiosRetry from 'axios-retry'
import { encode } from 'gpt-3-encoder'
import {
  ChatCompletionRequestMessage,
  CreateCompletionResponse,
} from 'openai-types'

export function createChatClient<TParsedResponse>(
  params: createChatClientParams<ResponseParserWithRetry<TParsedResponse>>,
): {
  fetchCompletion(request: {
    messages: ChatCompletionRequestMessage[]
    modelParams?: ModelParams
  }): Promise<TParsedResponse>
}

export function createChatClient<TParsedResponse>(
  params: createChatClientParams<ResponseParserWithoutRetry<TParsedResponse>>,
): {
  fetchCompletion(request: {
    messages: ChatCompletionRequestMessage[]
    modelParams?: ModelParams
  }): Promise<TParsedResponse>
}

export function createChatClient<TParsedResponse>(
  params: createChatClientParams<ResponseParser<TParsedResponse>>,
) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    modelId,
    modelDefaultParams = {
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    },
    parse = (response, _retry) => {
      return response.choices[0].text as unknown as TParsedResponse
    },
    trimTokens,
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
    retryDelay: (retryCount) => {
      if (process.env.NODE_ENV === 'test') {
        return 0
      }

      // Return time to delay in milliseconds
      return retryStrategy?.calculateDelay
        ? retryStrategy.calculateDelay(retryCount)
        : 2 ** retryCount * 1000 + // Exponential backoff: 1 second, then 2, 4, 8 etc
            (Math.floor(Math.random() * 50) + 1) // Additional random delay between 1 and 50 ms
    },
    retryCondition: (error) => {
      return retryStrategy?.shouldRetry
        ? retryStrategy.shouldRetry(error)
        : !!error.response?.status && error.response.status >= 400
    },
  })

  const fetchCompletion = async (
    request: {
      messages: ChatCompletionRequestMessage[]
      modelParams?: ModelParams
    },
    __parseRetryCount = 0,
  ): Promise<TParsedResponse> => {
    const { messages, modelParams } = request

    let trimmedMessages = messages
    if (trimTokens) {
      const maxTokensPerRequest = maxTokensByModelId[modelId]
      const tokenCount = getTokenCountForMessages(messages)

      if (maxTokensPerRequest && tokenCount > maxTokensPerRequest) {
        trimmedMessages = trimTokens(messages)

        const updatedTokenCount = getTokenCountForMessages(trimmedMessages)
        if (updatedTokenCount > maxTokensPerRequest) {
          throw new Error(
            `Token count (${tokenCount}) exceeds max tokens per request (${maxTokensPerRequest})`,
          )
        }
      }
    }

    const { data } = await axiosInstance.post<CreateCompletionResponse>(
      OPENAI_CHAT_COMPLETIONS_URL,
      {
        model: modelId,
        messages: trimmedMessages,
        ...modelDefaultParams,
        ...modelParams,
      },
    )

    if (!Array.isArray(data?.choices) || data.choices.length === 0) {
      throw new Error('No response from OpenAI')
    }

    const retry = ({
      feedback,
      updatedModelParams,
    }: {
      feedback?: string
      updatedModelParams?: ModelParams
    }) => {
      const feedbackMessage: ChatCompletionRequestMessage = {
        role: 'system',
        content: feedback ?? '',
      }

      const newRequest = {
        messages: feedback ? [...messages, feedbackMessage] : messages,
        modelParams: updatedModelParams
          ? { ...modelParams, ...updatedModelParams }
          : modelParams,
      }

      return fetchCompletion(newRequest, __parseRetryCount + 1)
    }

    if (parse.length === 1) {
      // FIXME: Remove the type assertion. I've tried everything but cannot appease the TS gods on this one.
      return (parse as ResponseParserWithoutRetry<TParsedResponse>)(data)
    }

    const parsedResponse = await parse(data, retry)

    return parsedResponse
  }

  return {
    fetchCompletion,
  }
}

export type createChatClientParams<TResponseParser> = {
  apiKey?: string
  modelId: 'gpt-3' | 'gpt-4' | 'gpt-3.5' | 'gpt-4-32k' // TODO: Need to allow for any string to support custom models but still look up token limit when known
  modelDefaultParams?: ModelParams
  parse?: TResponseParser
  trimTokens?: (
    messages: ChatCompletionRequestMessage[],
  ) => ChatCompletionRequestMessage[]
  retryStrategy?: {
    shouldRetry?: (error: AxiosError) => boolean
    calculateDelay?: (retryCount: number) => number
    maxRetries?: number
    updateModelParams?: (modelParams: any) => any
  }
}

export type RetryStrategy = createChatClientParams<any>['retryStrategy']

export type ModelParams = {
  max_tokens?: number
  temperature?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
}

type ResponseParser<T> =
  | ResponseParserWithRetry<T>
  | ResponseParserWithoutRetry<T>

type ResponseParserWithRetry<T> = (
  response: CreateCompletionResponse,
  retry: ({
    feedback,
    updatedModelParams,
  }: {
    feedback?: string
    updatedModelParams?: ModelParams
  }) => Promise<T>,
) => Promise<T>

type ResponseParserWithoutRetry<T> = (response: CreateCompletionResponse) => T

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'

// A TypeScript adaptation of https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
// They count a fixed number of tokens to account for the formatting the model uses, but we instead first format the messages the way
// the model will,  and then we count the total tokens for this formatted string.
// We also don't yet support the "name" field.
// They also account for replies, but we do this differently: we have the caller pass in minReponseTokens (optionally)
//  and make sure that request tokens + minResponseTokens < maxTokensPerRequest
const getTokenCountForMessages = (messages: ChatCompletionRequestMessage[]) =>
  encode(
    messages
      .map((m) => [`role: ${m.role}`, `content: ${m.content}`].join('\n'))
      .join('\n'),
  ).length

const maxTokensByModelId: Record<string, number> = {
  'gpt-4': 8192,
}
