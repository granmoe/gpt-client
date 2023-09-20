// Generated from the OpenAI OpenAPI spec on 9/18/2023
// https://github.com/openai/openai-openapi/blob/master/openapi.yaml

export interface ApiError {
  type: string
  message: string
  param?: string | null
  code?: string | null
}

export interface ErrorResponse {
  error: ApiError
}

export interface ListModelsResponse {
  object: string
  data: Model[]
}

export interface DeleteModelResponse {
  id: string
  object: string
  deleted: boolean
}

export interface CreateCompletionRequest {
  model?: string
  prompt?: string | string[] | number[] | number[][] | null
  suffix?: string | null
  max_tokens?: number | null
  temperature?: number | null
  top_p?: number | null
  n?: number | null
  stream?: boolean | null
  logprobs?: number | null
  echo?: boolean | null
  stop?: string | string[] | null
  presence_penalty?: number | null
  frequency_penalty?: number | null
  best_of?: number | null
  logit_bias?: {
    [k: string]: number
  } | null
  user?: string | null
}

export interface CreateCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    text: string
    index: number
    logprobs: {
      tokens: string[]
      token_logprobs: number[]
      top_logprobs: {
        [k: string]: number
      }
      text_offset: number[]
    } | null
    finish_reason: 'stop' | 'length'
  }>
  usage: CompletionUsage
}

export interface ChatCompletionRequestMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string | null
  name?: string
  function_call?: {
    name: string
    arguments: string
  }
}

export interface ChatCompletionFunctionParameters {
  // TODO: Can we put anything better here?
  // JSON Schema
}

export interface ChatCompletionFunctions {
  name: string
  description?: string
  parameters: ChatCompletionFunctionParameters
}

export interface ChatCompletionFunctionCallOption {
  name: string
}

export interface ChatCompletionResponseMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string | null
  function_call?: {
    name: string
    arguments: string
  }
}

export interface ChatCompletionStreamResponseDelta {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string | null
  function_call?: {
    name: string
    arguments: string
  }
}

export interface CreateChatCompletionRequest {
  model: string
  messages: ChatCompletionRequestMessage[]
  functions?: ChatCompletionFunctions[]
  function_call?: 'none' | 'auto' | ChatCompletionFunctionCallOption
  temperature?: number | null
  top_p?: number | null
  n?: number | null
  stream?: boolean | null
  stop?: string | string[] | null
  max_tokens?: number | null
  presence_penalty?: number | null
  frequency_penalty?: number | null
  logit_bias?: {
    [k: string]: number
  } | null
  user?: string | null
}

export interface CreateChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatCompletionResponseMessage
    finish_reason: 'stop' | 'length' | 'function_call'
  }>
  usage: CompletionUsage
}

export interface ListPaginatedFineTuningJobsResponse {
  object: string
  data: FineTuningJob[]
  has_more: boolean
}

export interface CreateEditRequest {
  model: 'text-davinci-edit-001' | 'code-davinci-edit-001'
  input?: string | null
  instruction: string
  n?: number | null
  temperature?: number | null
  top_p?: number | null
}

export interface CreateEditResponse {
  object: string
  created: number
  choices: Array<{
    text: string
    index: number
    finish_reason: 'stop' | 'length'
  }>
  usage: CompletionUsage
}

export interface CreateImageRequest {
  prompt: string
  n?: number | null
  size?: '256x256' | '512x512' | '1024x1024' | null
  response_format?: 'url' | 'b64_json' | null
  user?: string | null
}

export interface ImagesResponse {
  created: number
  data: ImageData[]
}

export interface ImageData {
  url?: string
  b64_json?: string
}

export interface CreateImageEditRequest {
  image: string // binary
  mask?: string // binary
  prompt: string
  n?: number | null
  size?: '256x256' | '512x512' | '1024x1024' | null
  response_format?: 'url' | 'b64_json' | null
  user?: string | null
}

export interface CreateImageVariationRequest {
  image: string // binary
  n?: number | null
  size?: '256x256' | '512x512' | '1024x1024' | null
  response_format?: 'url' | 'b64_json' | null
  user?: string | null
}

export interface CreateModerationRequest {
  input: string | string[]
  model?: 'text-moderation-latest' | 'text-moderation-stable'
}

export interface CreateModerationResponse {
  id: string
  model: string
  results: Array<{
    flagged: boolean
    categories: {
      hate: boolean
      'hate/threatening': boolean
      harassment: boolean
      'harassment/threatening': boolean
      'self-harm': boolean
      'self-harm/intent': boolean
      'self-harm/instructions': boolean
      sexual: boolean
      'sexual/minors': boolean
      violence: boolean
      'violence/graphic': boolean
    }
    category_scores: {
      hate: number
      'hate/threatening': number
      harassment: number
      'harassment/threatening': number
      'self-harm': number
      'self-harm/intent': number
      'self-harm/instructions': number
      sexual: number
      'sexual/minors': number
      violence: number
      'violence/graphic': number
    }
  }>
}

export interface ListFilesResponse {
  object: string
  data: OpenAIFile[]
}

export interface CreateFileRequest {
  file: string // binary
  purpose: string
}

export interface DeleteFileResponse {
  id: string
  object: string
  deleted: boolean
}

export interface CreateFineTuningJobRequest {
  training_file: string
  validation_file?: string | null
  model: string
  hyperparameters?: {
    n_epochs?: string | number
  }
  suffix?: string | null
}

export interface ListFineTuningJobEventsResponse {
  object: string
  data: FineTuningJobEvent[]
}

export interface CreateFineTuneRequest {
  training_file: string
  validation_file?: string | null
  model?: string | null
  n_epochs?: number | null
  batch_size?: number | null
  learning_rate_multiplier?: number | null
  prompt_loss_weight?: number | null
  compute_classification_metrics?: boolean | null
  classification_n_classes?: number | null
  classification_positive_class?: string | null
  classification_betas?: number[] | null
  suffix?: string | null
}

export interface ListFineTunesResponse {
  object: string
  data: FineTune[]
}

export interface ListFineTuneEventsResponse {
  object: string
  data: FineTuneEvent[]
}

export interface CreateEmbeddingRequest {
  model: 'text-embedding-ada-002'
  input: string | string[] | number[] | number[][]
  user?: string | null
}

export interface CreateEmbeddingResponse {
  object: string
  model: string
  data: Embedding[]
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

export interface CreateTranscriptionRequest {
  file: string // binary
  model: 'whisper-1'
  prompt?: string
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
  temperature?: number
  language?: string
}

export interface CreateTranscriptionResponse {
  text: string
}

export interface CreateTranslationRequest {
  file: string // binary
  model: 'whisper-1'
  prompt?: string
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
  temperature?: number
}

export interface CreateTranslationResponse {
  text: string
}

export interface Model {
  id: string
  object: string
  created: number
  owned_by: string
}

export interface OpenAIFile {
  id: string
  object: string
  bytes: number
  created_at: number
  filename: string
  purpose: string
  status?: string | null
  status_details?: string | null
}

export interface Embedding {
  index: number
  object: string
  embedding: number[]
}

export interface FineTuningJob {
  id: string
  object: string
  created_at: number
  finished_at?: number | null
  model: string
  fine_tuned_model?: string | null
  organization_id: string
  status: string
  hyperparameters?: {
    n_epochs?: string | number
  }
  training_file: string
  validation_file?: string | null
  result_files: string[]
  trained_tokens?: number | null
  error?: {
    message?: string
    code?: string
    param?: string | null
  } | null
}

export interface FineTuningJobEvent {
  id: string
  object: string
  created_at: number
  level: 'info' | 'warn' | 'error'
  message: string
  data: string | null
  type: 'message' | 'metrics'
}

export interface FineTune {
  id: string
  object: string
  created_at: number
  updated_at: number
  model?: string | null
  fine_tuned_model?: string | null
  organization_id: string
  status: string
  hyperparams: {
    n_epochs: number
    batch_size: number
    prompt_loss_weight: number
    learning_rate_multiplier: number
    compute_classification_metrics?: boolean
    classification_positive_class?: string | null
    classification_n_classes?: number | null
  }
  training_files: OpenAIFile[]
  validation_files: OpenAIFile[]
  result_files: OpenAIFile[]
  events: FineTuneEvent[]
}

export interface FineTuneEvent {
  object: string
  created_at: number
  level: string
  message: string
}

export interface CompletionUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}
