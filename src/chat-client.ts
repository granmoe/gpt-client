import { encode } from 'gpt-tokenizer'
import OpenAI from 'openai'
import { SchemaObject } from 'openapi3-ts/oas31'

export type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion

export type ChatCompletionMessageParam =
  OpenAI.Chat.Completions.ChatCompletionMessageParam

export type ModelParams = Omit<
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  'model' | 'messages'
>

export type ChatCompletionTool = {
  function: {
    /**
     * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain
     * underscores and dashes, with a maximum length of 64.
     */
    name: string
    /**
     * A description of what the function does, used by the model to choose when and
     * how to call the function.
     */
    description?: string
    /**
     * The parameters the functions accepts, described as a JSON Schema object. See the
     * [guide](https://platform.openai.com/docs/guides/gpt/function-calling) for
     * examples, and the
     * [JSON Schema reference](https://json-schema.org/understanding-json-schema/) for
     * documentation about the format.
     *
     * To describe a function that accepts no parameters, provide the value
     * `{"type": "object", "properties": {}}`.
     */
    parameters: SchemaObject
  }
  /**
   * The type of the tool. Currently, only `function` is supported.
   */
  type: 'function'
}

// DEFAULT PARSER
export function createChatClient(
  params: CreateChatClientWithDefaultParserParams,
): {
  createCompletion(request: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    /**
     * Controls which (if any) function is called by the model. `none` means the model
     * will not call a function and instead generates a message. `auto` means the model
     * can pick between generating a message or calling a function. Specifying a
     * particular function via
     * `{"type: "function", "function": {"name": "my_function"}}` forces the model to
     * call that function.
     *
     * `none` is the default when no functions are present. `auto` is the default if
     * functions are present.
     */
    tool_choice?: OpenAI.Chat.ChatCompletionToolChoiceOption
    /**
     * A list of tools the model may call. Currently, only functions are supported as a
     * tool. Use this to provide a list of functions the model may generate JSON inputs
     * for.
     */
    tools?: Array<ChatCompletionTool>
    modelParams?: ModelParams
  }): Promise<string | null>
}

// CUSTOM PARSER WITHOUT RETRY
export function createChatClient<TParsedResponse>(
  params: CreateChatClientWithCustomParserParams<
    ResponseParserWithoutRetry<TParsedResponse>
  >,
): {
  createCompletion(request: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    /**
     * Controls which (if any) function is called by the model. `none` means the model
     * will not call a function and instead generates a message. `auto` means the model
     * can pick between generating a message or calling a function. Specifying a
     * particular function via
     * `{"type: "function", "function": {"name": "my_function"}}` forces the model to
     * call that function.
     *
     * `none` is the default when no functions are present. `auto` is the default if
     * functions are present.
     */
    tool_choice?: OpenAI.Chat.ChatCompletionToolChoiceOption
    /**
     * A list of tools the model may call. Currently, only functions are supported as a
     * tool. Use this to provide a list of functions the model may generate JSON inputs
     * for.
     */
    tools?: Array<ChatCompletionTool>
    modelParams?: ModelParams
  }): Promise<TParsedResponse>
}

// CUSTOM PARSER WITH RETRY
export function createChatClient<TParsedResponse>(
  params: CreateChatClientWithCustomParserParams<
    ResponseParserWithRetry<TParsedResponse>
  >,
): {
  createCompletion(request: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    /**
     * Controls which (if any) function is called by the model. `none` means the model
     * will not call a function and instead generates a message. `auto` means the model
     * can pick between generating a message or calling a function. Specifying a
     * particular function via
     * `{"type: "function", "function": {"name": "my_function"}}` forces the model to
     * call that function.
     *
     * `none` is the default when no functions are present. `auto` is the default if
     * functions are present.
     */
    tool_choice?: OpenAI.Chat.ChatCompletionToolChoiceOption
    /**
     * A list of tools the model may call. Currently, only functions are supported as a
     * tool. Use this to provide a list of functions the model may generate JSON inputs
     * for.
     */
    tools?: Array<ChatCompletionTool>
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

  const openAiClient = new OpenAI({
    apiKey: openAiApiKey,
    maxRetries: 0,
  })

  const retryDelay = (retryCount: number) => {
    if (IS_TEST) {
      return 0
    }

    // Return time to delay in milliseconds
    return params.retryStrategy?.calculateDelay
      ? params.retryStrategy.calculateDelay(retryCount)
      : 2 ** retryCount * 1000 + // Exponential backoff: 1 second, then 2, 4, 8 etc
          (Math.floor(Math.random() * 50) + 1) // Additional random delay between 1 and 50 ms
  }

  const shouldRetry = (error: any) => {
    return params.retryStrategy?.shouldRetry
      ? params.retryStrategy.shouldRetry(error)
      : !!error.status && error.status >= 400
  }

  const updateModelParamsForRetry = (modelParams: ModelParams) => {
    if (!params.retryStrategy?.updateModelParams) {
      return modelParams
    }

    return params.retryStrategy.updateModelParams(modelParams)
  }

  const callOpenAiWithRetry = (
    request: {
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
      tool_choice?: OpenAI.Chat.ChatCompletionToolChoiceOption
      tools?: Array<ChatCompletionTool>
      modelParams?: ModelParams
    },
    options?: Parameters<typeof openAiClient.chat.completions.create>[1],
  ) => {
    let retryCount = 0

    async function makeRequest(modelParams: ModelParams) {
      try {
        const body = {
          model: params.modelId,
          messages: request.messages,
          tool_choice: request.tool_choice,
          tools: request.tools,
          ...modelParams,
        }

        return await openAiClient.chat.completions.create(body as any, options)
      } catch (err) {
        if (!(err instanceof OpenAI.APIError) && !IS_TEST) {
          throw err
        }

        if (retryCount >= (params.retryStrategy?.maxRetries ?? 2)) {
          throw err
        }

        if (shouldRetry(err)) {
          retryCount++

          const delay = retryDelay(retryCount)
          await new Promise((r) => setTimeout(r, delay))

          const updatedModelParams = updateModelParamsForRetry(modelParams)

          return makeRequest(updatedModelParams)
        }

        throw err
      }
    }

    const modelParamsForInitialRequest: ModelParams = {
      ...params.modelDefaultParams,
      ...request.modelParams,
    }

    return makeRequest(modelParamsForInitialRequest)
  }

  if ('parse' in params) {
    if (isResponseParserWithRetry<TParsedResponse>(params.parse)) {
      return createChatClientWithCustomParserWithRetry<TParsedResponse>(
        params as CreateChatClientWithCustomParserParams<
          ResponseParserWithRetry<TParsedResponse>
        >,
        callOpenAiWithRetry,
      )
    } else {
      return createChatClientWithCustomParserWithoutRetry<TParsedResponse>(
        params as CreateChatClientWithCustomParserParams<
          ResponseParserWithoutRetry<TParsedResponse>
        >,
        callOpenAiWithRetry,
      )
    }
  }

  return createChatClientWithDefaultParser(params, callOpenAiWithRetry)
}

export function createChatClientWithCustomParserWithRetry<TParsedResponse>(
  params: CreateChatClientWithCustomParserParams<
    ResponseParserWithRetry<TParsedResponse>
  >,
  callOpenAiWithRetry: CallOpenAiWithRetry,
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

  const tokenTrimmer = trimTokens ? makeTokenTrimmer(trimTokens) : null

  const createCompletion = async (
    request: {
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
      tool_choice?: OpenAI.Chat.ChatCompletionToolChoiceOption
      tools?: Array<ChatCompletionTool>
      modelParams?: ModelParams
    },
    __parseRetryCount = 0,
  ): Promise<TParsedResponse> => {
    const { messages, tool_choice, tools, modelParams } = request

    const trimmedMessages = tokenTrimmer
      ? tokenTrimmer(messages, modelId, minResponseTokens)
      : messages

    const chatCompletion = await callOpenAiWithRetry({
      messages: trimmedMessages,
      tools,
      tool_choice,
      ...modelDefaultParams,
      ...modelParams,
    })

    if (chatCompletion.choices.length === 0) {
      throw new Error('Empty response from OpenAI')
    }

    const retry = ({
      feedback,
      updatedModelParams,
    }: {
      feedback?: string
      updatedModelParams?: ModelParams
    }) => {
      const feedbackMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam =
        {
          role: 'system',
          content: feedback ?? '',
        }

      const newRequest = {
        messages: feedback ? [...messages, feedbackMessage] : messages,
        modelParams: updatedModelParams
          ? { ...modelParams, ...updatedModelParams }
          : modelParams,
      }

      return createCompletion(newRequest, __parseRetryCount + 1)
    }

    const parsedResponse = await parse(chatCompletion, retry)

    return parsedResponse
  }

  return {
    createCompletion,
  }
}

export function createChatClientWithCustomParserWithoutRetry<TParsedResponse>(
  params: CreateChatClientWithCustomParserParams<
    ResponseParserWithoutRetry<TParsedResponse>
  >,
  callOpenAiWithRetry: CallOpenAiWithRetry,
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

  const tokenTrimmer = trimTokens ? makeTokenTrimmer(trimTokens) : null

  const createCompletion = async (
    request: {
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
      tool_choice?: OpenAI.Chat.ChatCompletionToolChoiceOption
      tools?: Array<ChatCompletionTool>
      modelParams?: ModelParams
    },
    __parseRetryCount = 0,
  ): Promise<TParsedResponse> => {
    const { messages, tools, tool_choice, modelParams } = request

    const trimmedMessages = tokenTrimmer
      ? tokenTrimmer(messages, modelId, minResponseTokens)
      : messages

    const chatCompletion = await callOpenAiWithRetry({
      messages: trimmedMessages,
      tools,
      tool_choice,
      ...modelDefaultParams,
      ...modelParams,
    })

    if (chatCompletion.choices.length === 0) {
      throw new Error('Empty response from OpenAI')
    }

    return parse(chatCompletion)
  }

  return {
    createCompletion,
  }
}

export function createChatClientWithDefaultParser(
  params: CreateChatClientWithDefaultParserParams,
  callOpenAiWithRetry: CallOpenAiWithRetry,
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

  const tokenTrimmer = trimTokens ? makeTokenTrimmer(trimTokens) : null

  const createCompletion = async (
    request: {
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
      tool_choice?: OpenAI.Chat.ChatCompletionToolChoiceOption
      tools?: Array<ChatCompletionTool>
      modelParams?: ModelParams
    },
    __parseRetryCount = 0,
  ): Promise<string | null> => {
    const { messages, modelParams, tool_choice, tools } = request

    const trimmedMessages = tokenTrimmer
      ? tokenTrimmer(messages, modelId, minResponseTokens)
      : messages

    const chatCompletion = await callOpenAiWithRetry({
      messages: trimmedMessages,
      tools,
      tool_choice,
      ...modelDefaultParams,
      ...modelParams,
    })

    if (chatCompletion.choices.length === 0) {
      throw new Error('Empty response from OpenAI')
    }

    return chatCompletion.choices[0].message.content
  }

  return {
    createCompletion,
  }
}

// TODO: Incorporate tools token count here
const makeTokenTrimmer =
  (trimTokens: TrimTokens) =>
  (
    originalMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    modelId: string,
    minResponseTokens: number,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
    const maxTokensPerRequest = maxTokensByModelId[modelId]
    if (maxTokensPerRequest) {
      const tokenCount =
        getTokenCountForMessages(originalMessages) + minResponseTokens

      if (tokenCount > maxTokensPerRequest) {
        const overage = tokenCount - maxTokensPerRequest

        const trimmedMessages = trimTokens(originalMessages, overage)

        const updatedTokenCount =
          getTokenCountForMessages(trimmedMessages) + minResponseTokens

        if (updatedTokenCount > maxTokensPerRequest) {
          throw new Error(
            `Token count (${tokenCount}) exceeds max tokens per request (${maxTokensPerRequest})`,
          )
        }

        return trimmedMessages
      }
    }

    return originalMessages
  }

export type CreateChatClientWithCustomParserParams<TResponseParser> = {
  apiKey?: string
  modelId: string
  modelDefaultParams?: ModelParams
  parse: TResponseParser
  trimTokens?: TrimTokens
  minResponseTokens?: number
  retryStrategy?: {
    shouldRetry?: (error: InstanceType<typeof OpenAI.APIError>) => boolean
    calculateDelay?: (retryCount: number) => number
    maxRetries?: number
    updateModelParams?: (modelParams: ModelParams) => ModelParams
  }
}

export type TrimTokens = (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  overage: number,
) => OpenAI.Chat.Completions.ChatCompletionMessageParam[]

export type CreateChatClientWithDefaultParserParams = Omit<
  CreateChatClientWithCustomParserParams<any>,
  'parse'
>

export type RetryStrategy =
  CreateChatClientWithCustomParserParams<any>['retryStrategy']

export type ResponseParserWithRetry<T> = (
  response: OpenAI.Chat.Completions.ChatCompletion,
  retry: Retry<T>,
) => Promise<T>

export type Retry<T> = ({
  feedback,
  updatedModelParams,
}: {
  feedback?: string
  updatedModelParams?: ModelParams
}) => Promise<T>

// TODO: Find a way to get Core.RequestOptions out of 'openai' package
type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
type Headers = Record<string, string | null | undefined>

type OpenAiCoreRequestOptions<Req extends {} = Record<string, unknown>> = {
  method?: HTTPMethod
  path?: string
  query?: Req
  body?: Req
  headers?: Headers
  maxRetries?: number
  stream?: boolean
  timeout?: number
  httpAgent?: any
  signal?: AbortSignal
  idempotencyKey?: string
}

type CallOpenAiWithRetry = (
  request: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    functions?: OpenAI.Chat.ChatCompletionCreateParams.Function[]
    modelParams?: ModelParams
  },
  options?: OpenAiCoreRequestOptions,
) => Promise<OpenAI.Chat.Completions.ChatCompletion>

export type ResponseParserWithoutRetry<T = string> = (
  response: OpenAI.Chat.Completions.ChatCompletion,
) => T

function isResponseParserWithRetry<T>(
  parse: any,
): parse is ResponseParserWithRetry<T> {
  return parse.length === 2
}

// A TypeScript adaptation of https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
// They count a fixed number of tokens to account for the formatting the model uses, but we instead first format the messages the way
// the model will,  and then we count the total tokens for this formatted string.
// We also don't yet support the "name" field.
// They also account for replies, but we do this differently: we have the caller pass in minReponseTokens (optionally)
//  and make sure that request tokens + minResponseTokens < maxTokensPerRequest
const getTokenCountForMessages = (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
) =>
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
  'gpt-4-1106-preview': 128000,
}

const IS_TEST = process.env.NODE_ENV === 'test'
