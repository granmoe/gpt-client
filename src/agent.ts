import {
  ChatCompletion,
  ChatCompletionMessageParam,
  CreateChatClientWithDefaultParserParams,
  createChatClient,
} from 'create-chat-client'
import OpenAI from 'openai'
import { ZodSchema } from 'zod'

export function createAgent<T extends ReadonlyArray<Tool>>(
  // Users can pass a custom parse/retry (or retry with feedback) just for the agent here, separately
  // The passthrough chat client always uses a parser that just returns the ChatCompletionMessage
  config: {
    tools: T
  },
  chatClientParams?: CreateChatClientWithDefaultParserParams,
): Agent<T> {
  return new Agent(config.tools, chatClientParams)
}

class Agent<T extends ReadonlyArray<Tool>> {
  private tools: Record<string, Tool>
  private chatClient: ReturnType<
    typeof createChatClient<OpenAI.Chat.Completions.ChatCompletionMessage>
  >

  constructor(
    tools: T,
    chatClientParams: Omit<CreateChatClientWithDefaultParserParams, 'parse'> = {
      modelId: 'gpt-4',
    },
  ) {
    this.tools = tools.reduce((acc, tool) => {
      acc[tool.name] = tool
      return acc
    }, {} as Record<string, Tool>)

    this.chatClient = createChatClient({
      parse: (response: ChatCompletion) => {
        return response.choices[0].message
      },
      ...chatClientParams,
    })
  }

  // TODO: Add option to pass forced function call / tool_call
  // TODO: Support old and new API (function_call vs tool_call etc)
  async runConversation({
    messages,
  }: {
    messages: ChatCompletionMessageParam[]
  }): Promise<{
    message: string | null
    toolCalls: Array<ToolCall<Tool>>
  }> {
    const response = await this.chatClient.createCompletion({
      messages,
    })

    const invalidToolCalls = response.tool_calls?.filter(
      (toolCall) => !this.tools[toolCall.function.name],
    )

    if (invalidToolCalls?.length) {
      // Can this ever happen?
      console.log('Invalid tool calls', JSON.stringify(invalidToolCalls))
    }

    const toolCalls: Array<ToolCall<Tool>> = (response.tool_calls ?? [])
      .filter((toolCall) => this.tools[toolCall.function.name])
      .map((toolCall) => {
        const parseResult = this.tools[toolCall.function.name].schema.safeParse(
          toolCall.function.arguments,
        )

        if (parseResult.success) {
          return {
            id: toolCall.id,
            name: toolCall.function.name,
            isValid: true,
            data: parseResult.data,
          }
        }

        return {
          id: toolCall.id,
          name: toolCall.function.name,
          isValid: false,
          error: parseResult.error,
        }
      })

    return {
      message: response.content,
      toolCalls,
    }
  }
}

type Tool = {
  readonly name: string
  readonly description: string
  readonly schema: ZodSchema<any>
}

type ToolCall<T extends Tool> = {
  id: string
  name: T['name']
} & MapSuccessToIsValid<ReturnType<T['schema']['safeParse']>>

type MapSuccessToIsValid<T> = T extends { success: true; data: infer D }
  ? { isValid: true; data: D }
  : T extends { success: false; error: infer E }
  ? { isValid: false; error: E }
  : T
