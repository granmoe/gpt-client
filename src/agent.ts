import {
  ChatCompletion,
  ChatCompletionMessageParam,
  CreateChatClientWithDefaultParserParams,
  createChatClient,
} from 'create-chat-client'
import OpenAI from 'openai'
import { ZodSchema } from 'zod'

export function createAgent<T extends ReadonlyArray<Tool>>(
  // Eventually, allow users to pass a custom parse/retry (or retry with feedback) just for the agent here
  // The passthrough chat client must always use a parser that returns the ChatCompletionMessage so that
  // we can do custom parsing here and return strongly typed tool calls
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
    this.tools = toolArrayToMap(tools)

    this.chatClient = createChatClient({
      parse: (response: ChatCompletion) => {
        return response.choices[0].message
      },
      ...chatClientParams,
    })
  }

  async runConversation({
    messages,
    tools,
  }: {
    messages: ChatCompletionMessageParam[]
    tools?: Array<Tool>
  }): Promise<{
    message: string | null
    toolCalls: Array<ToolCall<Tool>>
  }> {
    const response = await this.chatClient.createCompletion({
      messages,
    })

    const toolsForRequest = tools ? toolArrayToMap(tools) : this.tools

    const toolCalls: Array<ToolCall<Tool>> = (response.tool_calls ?? [])
      .filter((toolCall) => {
        if (toolsForRequest[toolCall.function.name]) {
          return true
        }

        if (process.env.GPT_CLIENT_DEBUG === 'true') {
          console.log(
            `Tool "${toolCall.function.name}" not found in agent tools`,
          )
        }
      })
      .map((toolCall) => {
        const parseResult = toolsForRequest[
          toolCall.function.name
        ].schema.safeParse(toolCall.function.arguments)

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

const toolArrayToMap = (tools: ReadonlyArray<Tool>) => {
  return tools.reduce<Record<string, Tool>>((acc, tool) => {
    acc[tool.name] = tool
    return acc
  }, {})
}
