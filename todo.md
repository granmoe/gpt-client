- add max tokens for other main OpenAI models
- add minResponseTokens

- pull into ff

- Bolster existing tests

  - more retry scenarios
    - updateModelParams
    - assert number of HTTP calls and failed etc
  - parse
    - Zod example
    - updateModelParams
    - custom maxParseRetries

- README

  - Logo
  - "Fully-typed LLM"
  - Installation
  - Usage
  - Examples

- Publish again and share

---

- Wrap openai node instead? Would need to handle retry differently

- other tests to add
  - passing in various model params
  - e2e / scenarios that combine functionality tested in existing tests (retry + parse + trimTokens etc)

# Future

- Support "name" in messages and token counting
- Allow passing in custom maxTokensPerRequest (for custom (e.g. fine-tuned) models)
  - Throw error if people override a known model's maxTokensPerRequest tho
- Support more OpenAI models and APIs (not just chat)
  - Support streaming
