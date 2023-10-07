import axios, { AxiosError } from 'axios'
import axiosRetry from 'axios-retry'
import { encode } from 'gpt-3-encoder'
import type {
  ChatCompletionRequestMessage,
  CreateCompletionResponse,
} from 'openai-types'

export type {
  ChatCompletionRequestMessage,
  CreateCompletionResponse,
} from 'openai-types'

// DEFAULT PARSER
export function createChatClient(
  params: CreateChatClientWithDefaultParserParams,
): {
  fetchCompletion(request: {
    messages: ChatCompletionRequestMessage[]
    modelParams?: ModelParams
  }): Promise<string | null>
}

// CUSTOM PARSER WITH RETRY
export function createChatClient<TParsedResponse>(
  params: CreateChatClientWithCustomParserParams<
    ResponseParserWithoutRetry<TParsedResponse>
  >,
): {
  fetchCompletion(request: {
    messages: ChatCompletionRequestMessage[]
    modelParams?: ModelParams
  }): Promise<TParsedResponse>
}

// CUSTOM PARSER WITH RETRY
export function createChatClient<TParsedResponse>(
  params: CreateChatClientWithCustomParserParams<
    ResponseParserWithRetry<TParsedResponse>
  >,
): {
  fetchCompletion(request: {
    messages: ChatCompletionRequestMessage[]
    modelParams?: ModelParams
  }): Promise<TParsedResponse>
}

export function createChatClient<TParsedResponse>(
  params:
    | CreateChatClientWithCustomParserParams<
        ResponseParserWithRetry<TParsedResponse>
      >
    | CreateChatClientWithCustomParserParams<
        ResponseParserWithoutRetry<TParsedResponse>
      >
    | CreateChatClientWithDefaultParserParams,
) {
  const openAiApiKey = params.apiKey ?? process.env.OPENAI_API_KEY
  if (!openAiApiKey) {
    throw new Error(
      'OpenAI API key is required. You must either pass apiKey or set the OPENAI_API_KEY environment variable.',
    )
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
  })

  const { retryStrategy } = params

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

  if ('parse' in params) {
    // TODO: return either with retry or without based on type of params

    // Below is a type predicate that narrows the type of params.parse to ResponseParserWithRetry<TParsedResponse>
    // if (params.parse.length === 1) {
    if (isResponseParserWithRetry<TParsedResponse>(params.parse)) {
      return createChatClientWithCustomParserWithRetry<TParsedResponse>(
        params as CreateChatClientWithCustomParserParams<
          ResponseParserWithRetry<TParsedResponse>
        >,
        axiosInstance,
      )
    } else {
      return createChatClientWithCustomParserWithoutRetry<TParsedResponse>(
        params as CreateChatClientWithCustomParserParams<
          ResponseParserWithoutRetry<TParsedResponse>
        >,
        axiosInstance,
      )
    }
  }

  return createChatClientWithDefaultParser(params, axiosInstance)
}

export function createChatClientWithCustomParserWithRetry<TParsedResponse>(
  params: CreateChatClientWithCustomParserParams<
    ResponseParserWithRetry<TParsedResponse>
  >,
  axiosInstance: axios.AxiosInstance,
) {
  const {
    modelId,
    modelDefaultParams = {
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    },
    parse,
    trimTokens,
    minResponseTokens = 0,
  } = params

  const fetchCompletion = async (
    request: {
      messages: ChatCompletionRequestMessage[]
      modelParams?: ModelParams
    },
    __parseRetryCount = 0,
  ): Promise<TParsedResponse> => {
    const { messages, modelParams } = request

    let trimmedMessages = messages
    const maxTokensPerRequest = maxTokensByModelId[modelId]
    if (trimTokens && maxTokensPerRequest) {
      const tokenCount = getTokenCountForMessages(messages) + minResponseTokens

      if (tokenCount > maxTokensPerRequest) {
        const overage = tokenCount - maxTokensPerRequest

        trimmedMessages = trimTokens(messages, overage)

        const updatedTokenCount =
          getTokenCountForMessages(trimmedMessages) + minResponseTokens

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

    const parsedResponse = await parse(data, retry)

    return parsedResponse
  }

  return {
    fetchCompletion,
  }
}

export function createChatClientWithCustomParserWithoutRetry<TParsedResponse>(
  params: CreateChatClientWithCustomParserParams<
    ResponseParserWithoutRetry<TParsedResponse>
  >,
  axiosInstance: axios.AxiosInstance,
) {
  const {
    modelId,
    modelDefaultParams = {
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    },
    parse,
    trimTokens,
    minResponseTokens = 0,
  } = params

  const fetchCompletion = async (
    request: {
      messages: ChatCompletionRequestMessage[]
      modelParams?: ModelParams
    },
    __parseRetryCount = 0,
  ): Promise<TParsedResponse> => {
    const { messages, modelParams } = request

    let trimmedMessages = messages
    const maxTokensPerRequest = maxTokensByModelId[modelId]
    if (trimTokens && maxTokensPerRequest) {
      const tokenCount = getTokenCountForMessages(messages) + minResponseTokens

      if (tokenCount > maxTokensPerRequest) {
        const overage = tokenCount - maxTokensPerRequest

        trimmedMessages = trimTokens(messages, overage)

        const updatedTokenCount =
          getTokenCountForMessages(trimmedMessages) + minResponseTokens

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

    return parse(data)
  }

  return {
    fetchCompletion,
  }
}

export function createChatClientWithDefaultParser(
  params: CreateChatClientWithDefaultParserParams,
  axiosInstance: axios.AxiosInstance,
) {
  const {
    modelId,
    modelDefaultParams = {
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    },
    trimTokens,
    minResponseTokens = 0,
  } = params

  const fetchCompletion = async (
    request: {
      messages: ChatCompletionRequestMessage[]
      modelParams?: ModelParams
    },
    __parseRetryCount = 0,
  ): Promise<string | null> => {
    const { messages, modelParams } = request

    let trimmedMessages = messages
    const maxTokensPerRequest = maxTokensByModelId[modelId]
    if (trimTokens && maxTokensPerRequest) {
      const tokenCount = getTokenCountForMessages(messages) + minResponseTokens

      if (tokenCount > maxTokensPerRequest) {
        const overage = tokenCount - maxTokensPerRequest

        trimmedMessages = trimTokens(messages, overage)

        const updatedTokenCount =
          getTokenCountForMessages(trimmedMessages) + minResponseTokens

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

    return data.choices[0].message.content
  }

  return {
    fetchCompletion,
  }
}

export type CreateChatClientWithCustomParserParams<TResponseParser> = {
  apiKey?: string
  modelId: string
  modelDefaultParams?: ModelParams
  parse: TResponseParser
  trimTokens?: (
    messages: ChatCompletionRequestMessage[],
    overage: number,
  ) => ChatCompletionRequestMessage[]
  minResponseTokens?: number
  retryStrategy?: {
    shouldRetry?: (error: AxiosError) => boolean
    calculateDelay?: (retryCount: number) => number
    maxRetries?: number
    updateModelParams?: (modelParams: any) => any
  }
}

export type CreateChatClientWithDefaultParserParams = Omit<
  CreateChatClientWithCustomParserParams<any>,
  'parse'
>

export type RetryStrategy =
  CreateChatClientWithCustomParserParams<any>['retryStrategy']

export type ModelParams = {
  max_tokens?: number
  temperature?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
}

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

type ResponseParserWithoutRetry<T = string> = (
  response: CreateCompletionResponse,
) => T

function isResponseParserWithRetry<T>(
  parse: any,
): parse is ResponseParserWithRetry<T> {
  return parse.length === 2
}

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
  'gpt-3.5-turbo': 4097,
  'gpt-3.5-turbo-0301': 4097,
  'gpt-3.5-turbo-0613': 4097,
  'gpt-3.5-turbo-16k': 16385,
  'gpt-3.5-turbo-16k-0613': 16385,
  'gpt-4': 8192,
  'gpt-4-0314': 8192,
  'gpt-4-0613': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-32k-0314': 32768,
  'gpt-4-32k-0613': 32768,
}
