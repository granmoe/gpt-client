import OpenAI from 'openai'
import { ZodError, ZodSchema } from 'zod'
import { generateSchema } from '@anatine/zod-openapi'

import {
  ChatCompletion,
  CreateChatClientWithDefaultParserParams,
  createChatClient,
} from './create-chat-client'

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
  private toolsArray: T
  private chatClient: ReturnType<
    typeof createChatClient<OpenAI.Chat.Completions.ChatCompletionMessage>
  >

  constructor(
    tools: T,
    chatClientParams: Omit<CreateChatClientWithDefaultParserParams, 'parse'> = {
      modelId: 'gpt-4',
    },
  ) {
    this.toolsArray = tools
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
  public async runConversation<TToolsParam extends ReadonlyArray<Tool> = T>({
    messages,
    tools,
  }: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[]
    tools?: TToolsParam
  }): Promise<{
    message: string | null
    toolCalls: TToolsParam extends ReadonlyArray<Tool>
      ? ToolCalls<TToolsParam>
      : ToolCalls<T>
    invalidToolCalls: Array<
      OpenAI.Chat.ChatCompletionMessageToolCall & { error?: ZodError }
    >
  }> {
    const chatCompletionTools = (tools ?? this.toolsArray).map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: generateSchema(tool.schema),
      },
    }))

    const response = await this.chatClient.createCompletion({
      messages,
      tools: chatCompletionTools,
    })

    const toolsForRequest = tools ? toolArrayToMap(tools) : this.tools

    const toolCalls = []
    const invalidToolCalls: Array<
      OpenAI.Chat.ChatCompletionMessageToolCall & { error?: ZodError }
    > = []

    for (const toolCall of response.tool_calls ?? []) {
      if (!toolsForRequest[toolCall.function.name]) {
        invalidToolCalls.push(toolCall)
        continue
      }

      const parseResult = toolsForRequest[
        toolCall.function.name
      ].schema.safeParse(JSON.parse(toolCall.function.arguments))

      if (parseResult.success === false) {
        invalidToolCalls.push({ ...toolCall, error: parseResult.error })
      } else {
        toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: parseResult.data,
        })
      }
    }

    return {
      message: response.content,
      toolCalls: toolCalls as unknown as TToolsParam extends ReadonlyArray<Tool>
        ? ToolCalls<TToolsParam>
        : ToolCalls<T>,
      invalidToolCalls,
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
    arguments: ReturnType<T[Key]['schema']['parse']>
  }
}
