# NEXT

- Update openai version
- Get agent working
  - Use default chat client and let user passthrough the options, but add a custom parse to get message and function calls
  - Actually use anatine lib to create OpenAPI spec for function calls before sending call
- Share and get feedback

# OLD

- Update per tools and tool_choice OpenAI API change

- Make default parser aware of function calling
- Types around function calling
- Add new models (gpt-4-1106-preview etc)

# Keep working on this lib or not?

- With function calling, no need for validation
- Token trimming can be done based on LLM response
- Retry may be useful
- Maybe emulate Python Instructor lib

# Tests

- more retry scenarios
  - updateModelParams
  - assert number of HTTP calls and failed etc
- parse
  - Zod example
  - updateModelParams
  - custom maxParseRetries
- trimTokens overage
- pass in various model params
- e2e / scenarios that combine functionality tested in existing tests (retry + parse + trimTokens etc)

# Future

- STREAMING
- Make trimTokens account for functions passed in OpenAI request
- Make retry aware of delay time in OpenAI response and incorporate "jitter" and the other stuff the official client does
- Consider throwing custom error from parse instead? Would make types cleaner. Then we only retry if it’s custom error, so people can opt out by just not throwing that error.
- Support "name" in messages and token counting
- Allow passing in custom maxTokensPerRequest (for custom (e.g. fine-tuned) models)
  - Throw error if people override a known model's maxTokensPerRequest tho
- Support more OpenAI models and APIs (not just chat)

# Misc

- Cool logo
- Get added to this https://platform.openai.com/docs/libraries/community-libraries
