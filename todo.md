- OpenAI types (from OpenAI OpenAPI spec?)
- allow throwing from parseResponse in order to retry call (and have max retries for this)
- add handleTokenLimitExceeded functionality
- model configs (including context window length etc)
  - can start with only OpenAI and a few essential models to start
- build
- publish
- readme
- tests
  - advanced retry scenarios
    - updateModelParams
    - assert number of HTTP calls and failed etc
  - parseResponse
    - Zod example
  - model params
  - e2e (retry + parseResponse etc)

# Future

- Support streaming
- Support more OpenAI models and APIs (not just chat)
