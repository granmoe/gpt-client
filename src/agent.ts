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
  // class Agent<T extends ReadonlyArray<Tool<any>>> {
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

  /**
   * @param messages - An array of ChatCompletionMessageParam objects ({ role: 'user' | 'agent' | 'system', content: string })
   */
  async runConversation({
    messages,
  }: {
    messages: ChatCompletionMessageParam[]
  }): Promise<{
    message: string | null
    toolCalls: ToolCalls<T>
  }> {
    const response = await this.chatClient.createCompletion({
      messages,
    })

    const toolCalls = (response.tool_calls ?? [])
      .filter((toolCall) => {
        if (this.tools[toolCall.function.name]) {
          return true
        }

        if (process.env.GPT_CLIENT_DEBUG === 'true') {
          console.log(
            `Tool "${toolCall.function.name}" not found in agent tools`,
          )
        }
      })
      .map((toolCall) => {
        const parseResult = this.tools[toolCall.function.name].schema.safeParse(
          toolCall.function.arguments,
        )

        return {
          id: toolCall.id,
          name: toolCall.function.name,
          isValid: parseResult.success,
          ...(parseResult.success
            ? { data: parseResult.data }
            : {
                error: parseResult.error,
              }),
        }
      })

    return {
      message: response.content,
      toolCalls: toolCalls as unknown as ToolCalls<T>,
    }
  }
}

type Tool = {
  readonly name: string
  readonly description: string
  readonly schema: ZodSchema<any>
}

const toolArrayToMap = (tools: ReadonlyArray<Tool>) => {
  return tools.reduce<Record<string, Tool>>((acc, tool) => {
    acc[tool.name] = tool
    return acc
  }, {})
}

type ToolCalls<T extends ReadonlyArray<Tool>> = {
  [Key in keyof T]: {
    id: string
    name: T[Key]['name']
  } & RenameSuccessToIsValid<ReturnType<T[Key]['schema']['safeParse']>>
}

type RenameSuccessToIsValid<T> = T extends {
  success: infer S
  data: infer D
}
  ? { isValid: S; data: D }
  : T extends { success: infer S; error: infer E }
  ? { isValid: S; error: E }
  : T
