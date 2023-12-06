// import OpenAI from 'openai'
import { z } from 'zod'
import { generateSchema } from '@anatine/zod-openapi'

// let func: OpenAI.Chat.ChatCompletionCreateParams.Function

test('Converts a zod schema to a function defintion', () => {
  const t = z.object({
    foo: z.number().optional(),
    bar: z.number(),
    baz: z.array(z.string()),
  })

  const openApiSchema = generateSchema(t)

  // Func def for OpenAI needs: name, description, parameters object
  // Params are represented by the zod schema
  // name and description must be passed in as separate args
  console.log(openApiSchema)

  // createFunctionClient({ name, description, schema })
  // createToolsClient([{ name, description, schema }])
  // Then user can force the tool or not with each call, default to func name for createFunctionClient
  // But default to auto for tools client

  // description is required

  // OR! Just change existing client such that you can optionally pass in { name, description, schema } when making a request (and maybe also when creating the client to set as default)
  // So call will look like client.createCompletion({ messages, function: { name, description, schema } }) and then we auto validate
  // Caller can pass in a validate function if they want to do logging etc if it fails or maybe we just return a failure reason or error type etc
})
