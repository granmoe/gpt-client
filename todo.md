- pull into ff

- Wrap openai node instead? Would need to handle retry differently

- readme

- tests
  - more retry scenarios
    - updateModelParams
    - assert number of HTTP calls and failed etc
  - parseResponse
    - Zod example
    - updateModelParams
    - custom maxParseRetries
  - model params
  - e2e (retry + parseResponse etc)

# Future

- add handleTokenLimitExceeded functionality
  - model configs (including context window length etc)
    - can start with only OpenAI and a few essential models to start
- Fix parseResponse without retry type inference for response
- Make it so we don't have to tack \_\_parseRetryCount onto fetchCompletion
- Support streaming
- Support more OpenAI models and APIs (not just chat)

# Launch

- Cool README
  - Logo
  - "Fully-typed LLM"
