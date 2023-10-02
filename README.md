# GPT Toolkit

A TypeScript powerhouse for OpenAI's GPT models. Supercharge your interactions with GPT using this toolkit that not only **makes GPT model responses fully-typed** but also streamlines common needs like retry strategies, trimming tokens when you exceed the max token count, and parsing and then optionally retrying with feedback and a lower temperature 😎

## 🌟 Key Features:

- 🤩 **Fully-Typed LLMs**: Simply pass a `parse` function and get guaranteed type-safe responses back from your OpenAI calls!
- 🔄 **Retry**: Gracefully handle failures with customizable conditions and exponential backoffs.
- 🪶 **Token Management**: Ensure your requests always fit the model's token limit by passing a trimTokens function that gives you the overage count and lets you trim tokens in just the right way for your application.
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

### **Experience Fully-Typed LLMs:**

Simply pass a `parse` function and get typed responses back from your OpenAI calls!

```typescript
const gptClient = createChatClient({
  modelId: 'gpt-4',
  parse: (response): ExampleType => {
    return JSON.parse(response.choices[0].message.content) // Do any validation here!
  },
})

// `result`` is of type ExampleType 😎
const result = await gptClient.fetchCompletion({
  messages: [
    {
      role: 'user',
      content: 'Tell me about TypeScript',
    },
  ],
})
```

### **Parse and Retry With Feedback:**

```typescript
const gptClient = createChatClient<ExampleType>({
  modelId: 'gpt-4',
  parse: async (response, retry) => {
    // `response` is inferred for you as the OpenAI CreateCompletionResponse type
    try {
      const json = JSON.parse(response.choices[0].message.content)
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
import { z } from 'zod'

// Define a Zod schema for your expected data structure
const ExampleTypeSchema = z.object({
  title: z.string(),
  description: z.string(),
})

const gptClient = createChatClient<z.infer<typeof ExampleTypeSchema>>({
  modelId: 'gpt-4',
  parse: async (response, retry) => {
    const text = response.choices[0].message.content

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
  shouldRetry: (error) => error.response?.status === 500,
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

More extensive documentation planned. (PRs welcome!)

## 🌱 Contribute:

Your feedback and expertise is most welcome! Share bugs, request features, or contribute directly by submitting a pull request.

## 📝 License:

Licensed under the MIT License.

---

**GPT Toolkit** – Easy type-safe interactions with OpenAI models! 🌌🚀
