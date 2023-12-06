import {
  ChatCompletion,
  ChatCompletionMessageParam,
  CreateChatClientWithDefaultParserParams,
  createChatClient,
} from 'create-chat-client'
import OpenAI from 'openai'
import { ZodSchema } from 'zod'

export function createAgent<T extends ReadonlyArray<Tool>>(
  // Users can pass a custom parse/retry (or retry with feedback) just for the agent here
  // The passthrough chat client will always use a parser that just returns the ChatCompletionMessage
  config: {
    tools: T
  },
  chatClientParams: CreateChatClientWithDefaultParserParams,
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
    chatClientParams: CreateChatClientWithDefaultParserParams,
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
  // TODO: Support old and new API
  async runConversation({
    messages,
  }: {
    messages: ChatCompletionMessageParam[]
  }): Promise<
    {
      [Key in keyof T]: {
        name: T[Key]['name']
        args: ReturnType<T[Key]['schema']['parse']>
      }
    }[number][]
  > {
    const response = await this.chatClient.createCompletion({
      messages,
    })

    return {
      ...response,
      ...(response.function_call && {
        function_call: {
          name: response.function_call.name,
          args: this.tools[response.function_call.name].schema.parse(
            response.function_call.arguments,
          ),
        },
      }),
    }

    // return openAiResponse
    //   .filter((call) => this.tools[call.functionName])
    //   .map((call) => ({
    //     name: call.functionName,
    //     args: this.tools[call.functionName]?.schema.parse(call.args),
    //   }))
  }
}

export type Tool = {
  readonly name: string
  readonly description: string
  readonly schema: ZodSchema<any>
}
