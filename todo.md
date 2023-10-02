- Cool logo

- Something weird may be going on where only the type of CreateCompletionResponse in parse is inferred, but none of its properties 🤔

- Get added to this https://platform.openai.com/docs/libraries/community-libraries

- Consider throwing custom error from parse instead? Would make types cleaner. Then we only retry if it’s custom error, so people can opt out by just not throwing that error.

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

- Wrap openai node instead? Would need to handle retry differently
- Support "name" in messages and token counting
- Allow passing in custom maxTokensPerRequest (for custom (e.g. fine-tuned) models)
  - Throw error if people override a known model's maxTokensPerRequest tho
- Support more OpenAI models and APIs (not just chat)
  - Support streaming
