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
    toolCalls: {
      [Key in keyof T]: {
        id: string
        name: T[Key]['name']
        args: ReturnType<T[Key]['schema']['safeParse']>
      }
    }[number][]
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

    const toolCalls = (response.tool_calls ?? [])
      .filter((toolCall) => this.tools[toolCall.function.name])
      .map((toolCall) => {
        return {
          id: toolCall.id,
          name: toolCall.function.name,
          args: this.tools[toolCall.function.name].schema.safeParse(
            toolCall.function.arguments,
          ),
        }
      })

    return {
      message: response.content,
      toolCalls,
    }
  }
}

export type Tool = {
  readonly name: string
  readonly description: string
  readonly schema: ZodSchema<any>
}
