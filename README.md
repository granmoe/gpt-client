# GPT Toolkit - Statically Typed LLMs

Pass in some Zod schemas, get a statically typed AI agent back!

```typescript
const tools = [
  {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    schema: z.object({
      location: z.string(),
    }),
  },
  // ... add as many tools as you want here
] as const // <-- Important! You must pass a readonly array

const agent = createAgent({ tools })

const { toolCalls } = await agent.runConversation({ messages })

for (const toolCall of toolCalls) {
  if (toolCall.name === 'get_weather') {
    // toolCall.arguments is statically typed! TypeScript knows that toolCall.arguments.location is a string and that it's the only property on `arguments`
    return fetchWeather(toolCall.arguments.location)
  }
}
```

GPT Toolkit is a TypeScript powerhouse that not only takes OpenAI function calling to the next level, but streamlines common needs like retry strategies and token management. And GPT Toolkit wraps the official OpenAI API npm package, so you don't have to worry about getting too far away from the official library--GPT Toolkit tracks the official library and uses its types.

## 🌟 Key Features:

- 🤩 **Statically Typed LLMs (including tools / function calling)**: Define tools via Zod schemas or pass a `parse` function and get guaranteed type-safe responses back from your OpenAI calls!
- 🔄 **Retry**: Pass in an easy-to-create retry strategy and gracefully handle failures with customizable conditions and exponential backoffs.
- 🪶 **Token Management**: Ensure your requests always fit the model's token limit by passing a trimTokens function that gives you the overage count and lets you trim tokens however makes sense for your application.
- 🛡 **Synced with OpenAI's OpenAPI Spec**: Always stay updated with types directly synced to OpenAI's OpenAPI spec and inferred for you.

## 📦 Installation:

```bash
npm install gpt-toolkit
```

or

```bash
pnpm install gpt-toolkit
```

or

```bash
yarn add gpt-toolkit
```

## 🚀 Usage:

### **Create a fully-typed AI agent:**

```typescript
const tools = [
  {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    schema: z.object({
      location: z.string(),
    }),
  },
] as const // <-- Important! Makes the array readonly so are types are inferred cleanly

const agent = createAgent({ tools })

const { toolCalls } = await agent.runConversation({
  messages: [
    {
      role: 'user',
      content: 'What is the weather like in London?',
    },
  ],
})

for (const toolCall of toolCalls) {
  if (toolCall.name === 'get_weather') {
    return fetchWeather(toolCall.arguments.location) // <-- toolCall.arguments is statically typed! TypeScript knows that toolCall.arguments.location is a string and that it's the only property on `arguments`, matching the Zod schema we passed in above 😎
  }
}
```

### **Pass as many tools as you want:**

```typescript
const tools = [
  {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    schema: z.object({
      location: z.string(),
    }),
  },
  {
    name: 'buy_stock',
    description: 'Buy a stock',
    schema: z.object({
      symbol: z.string(),
      shares: z.number(),
    }),
  },
] as const // <-- Important! Always pass a readonly array

const agent = createAgent({ tools })

const { toolCalls } = await agent.runConversation({
  messages: [
    {
      role: 'user',
      content: 'What is the weather like in London?',
    },
  ],
})

let weatherResult
let stockResult

for (const toolCall of toolCalls) {
  if (toolCall.name === 'get_weather') {
    weatherResult = await fetchWeather(toolCall.arguments.location)
  } else if (toolCall.name === 'buy_stock') {
    stockResult = await buyStock(
      toolCall.arguments.symbol,
      toolCall.arguments.shares,
    )
  }
}
```

### **Override tools per call:**

```typescript
const tools = [
  {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    schema: z.object({
      location: z.string(),
    }),
  },
] as const

const agent = createAgent({ tools })

const otherTools = [
  {
    name: 'buy_stock',
    description: 'Buy a stock',
    schema: z.object({
      symbol: z.string(),
      shares: z.number(),
    }),
  },
] as const

const { toolCalls } = await agent.runConversation({
  messages: [
    {
      role: 'user',
      content: `Please buy 100 shares of Fake Company stock`,
    },
  ],
  // Override tools for this call
  tools: otherTools,
})

for (const toolCall of toolCalls) {
  // This is the only tool call type that can be returned for this call
  if (toolCall.name === 'buy_stock') {
    // Process stock tool call
  }
}
```

### **Parse a "one per line" response:**

(Note: so far, we only have support for non-streaming chat completion clients - more to come!)

Simply pass a `parse` function and get typed responses back from your OpenAI calls!

```typescript
import { createChatClient, ChatCompletion } from 'gpt-toolkit'

const gptClient = createChatClient({
  modelId: 'gpt-4',
  parse: (completion: ChatCompletion) => {
    if (completion.choices[0].message.content !== null) {
      const message = completion.choices[0].message.content
      const lines = message.split('\n').map(Number)

      if (lines.length === 2 && lines.every((n) => !isNaN(n))) {
        return lines as [number, number]
      }
    }
  },
})

// `completion` is of type `[number, number] | undefined` 😎
// Handle the `undefined` case below, or use the built-in retry function directly within parse! (See examples below)
const completion = await gptClient.createCompletion({
  messages: [
    {
      role: 'user',
      content: 'Please return two numbers from 0-10, one per line',
    },
  ],
})
```

### **Parse and Retry With Feedback:**

```typescript
import { createChatClient, ChatCompletion, Retry } from 'gpt-toolkit'

const gptClient = createChatClient<ExampleType>({
  modelId: 'gpt-4',
  parse: async (completion: ChatCompletion, retry: Retry<ExampleType>) => {
    try {
      const json = JSON.parse(completion: ChatCompletion.choices[0].message.content)
      return json as ExampleType
    } catch (error) {
      return retry({
        feedback: 'Pass any feedback to GPT-4 here!',
        updatedModelParams: {
          temperature: 0, // You can turn down temp on retry (and modify any other model params)
        },
      })
    }
  },
})
```

### **Parse and Validate With Zod:**

```typescript
import { createChatClient, ChatCompletion, Retry } from 'gpt-toolkit'
import { z } from 'zod'

// Define a Zod schema for your expected data structure
const ExampleTypeSchema = z.object({
  title: z.string(),
  description: z.string(),
})

type ExampleType = z.infer<typeof ExampleTypeSchema>

const gptClient = createChatClient<ExampleType>({
  modelId: 'gpt-4',
  parse: async (completion: ChatCompletion, retry: Retry<ExampleType>) => {
    const text = completion.choices[0].message.content

    try {
      const parsedData = JSON.parse(text)
      const validationResult = ExampleTypeSchema.safeParse(parsedData)

      if (validationResult.success) {
        return validationResult.data
      } else {
        const zodErrors = validationResult.error.issues
          .map((issue) => issue.message)
          .join(', ')
        return retry({
          feedback: `There was a validation error: ${zodErrors}. Please format your response correctly!`,
        })
      }
    } catch (error) {
      return retry({ feedback: 'Please provide a valid JSON response.' })
    }
  },
})
```

### **Custom Retry Strategy:**

```typescript
const retryStrategy: RetryStrategy = {
  shouldRetry: (error) => error.status === 500,
  calculateDelay: (retryCount) => 1000 * Math.max(retryCount, 1),
  maxRetries: 2,
}

const gptClient = createChatClient({
  modelId: 'gpt-4',
  retryStrategy,
})
```

### **Trim Tokens - Easy and Flexible:**

```typescript
const gptClient = createChatClient({
  modelId: 'gpt-4',
  // overage is the number of tokens by which you've exceeded the limit
  trimTokens: (messages, overage) => {
    // Do whatever you want in here--just return an array of message on your way out!
    if (messages.length > 1) {
      return messages.slice(1)
    }

    return messages
  },
  minResponseTokens: 400,
})
```

`trimTokens` will be called any time your request messages token count + minResponseTokens (if passed) exceeds the max tokens for your chosen model. The messages you return from it will be sent in the request to OpenAI instead of the original messages.

## 📖 Documentation:

I plan to add more extensive documentation if this gains traction, but for now, the best way to learn is to read the code and the tests.

## 🌱 Contribute:

Your feedback and expertise is most welcome! Share bugs, request features, or contribute directly by submitting a pull request.

## 📝 License:

Licensed under the MIT License.

---

**GPT Toolkit** – Easy type-safe interactions with OpenAI models! 🌌🚀
