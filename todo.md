# Next

- Factor tools into token count
- Test if you can pass something other than an object schema as function params
- Support passing in tool call results in a completion request
- Merge to main, publish a new major version, share and get feedback
- Playground / examples, link from README

- Need to understand conditional type assertion in return deeper - super weird and interesting

# OLD

- Make default parser aware of function calling
- Types around function calling

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
