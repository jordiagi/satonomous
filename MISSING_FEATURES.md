# Satonomous Missing Features & Implementation Plans

This document outlines missing features and recommended enhancements for the `satonomous` TypeScript SDK, along with detailed implementation plans for agents to execute.

---

## 1. Request Retries and Rate Limiting

**Context:**  
Network requests in `src/client.ts` use the native `fetch` API. Currently, they fail immediately if a 5xx or network error occurs, or if a 429 Too Many Requests response is returned.

**Issue:**  
Lack of resilience against transient network glitches, 5xx server errors, or API rate-limiting leads to brittle AI agent behavior.

**Recommendation:**  
Implement an automatic retry mechanism with exponential backoff and jitter. Respect `Retry-After` headers when handling 429 rate limits.

**Implementation Plan:**
- **Step 1:** Create a `fetchWithRetry` wrapper inside `src/client.ts` (or a separate `http.ts` utility).
- **Step 2:** Configure default retry options: `maxRetries` (e.g., 3), `baseDelayMs` (e.g., 500).
- **Step 3:** Wrap the `fetch` call in a `for` loop up to `maxRetries`.
- **Step 4:** Catch network exceptions and check for HTTP 429 or 5xx statuses. If matched, pause execution.
- **Step 5:** If 429, parse the `Retry-After` header to determine the wait time. Otherwise, use `baseDelayMs * (2 ** attempt)` with added jitter.
- **Step 6:** Replace the standard `fetch` call in `request<T>` with `fetchWithRetry`.

---

## 2. Request Cancellation (AbortController)

**Context:**  
Long-running requests, such as polling for contract actions or deposits in `src/client.ts`, cannot be aborted natively.

**Issue:**  
If an agent shuts down or a user cancels an operation, the fetch promises will continue to dangle, wasting resources.

**Recommendation:**  
Add `AbortSignal` support to all asynchronous API methods and polling loops.

**Implementation Plan:**
- **Step 1:** Update `L402AgentOptions` in `src/types.ts` to accept an optional default `AbortSignal`.
- **Step 2:** Add an optional `signal?: AbortSignal` property to all method options interfaces (e.g., `ContractActionOptions`, `WaitForContractActionOptions`, `ListOffersParams`).
- **Step 3:** In `src/client.ts`, pass the `signal` down into the `request<T>` method.
- **Step 4:** Pass the `signal` to the native `fetch(url, { ...options, signal })` call.
- **Step 5:** In polling loops (like `deposit` and `waitForContractAction`), explicitly check `if (options.signal?.aborted) throw new Error('Aborted')` inside the `while` loop before waiting.

---

## 3. Webhook / Server-Sent Events (SSE) Support

**Context:**  
Methods like `deposit` and `waitForContractAction` rely on naive `while` loop polling with `setTimeout`.

**Issue:**  
Polling introduces latency and consumes unnecessary CPU/network cycles for both the client and the gateway.

**Recommendation:**  
Provide Server-Sent Events (SSE) support for real-time contract and invoice updates.

**Implementation Plan:**
- **Step 1:** Add a new method `watchContract(contractId: string, signal?: AbortSignal)` to `L402Agent` that connects to a backend SSE endpoint (e.g., `GET /api/v1/contracts/:id/events`).
- **Step 2:** Use the `EventSource` API (or a robust fetch-based SSE parser if running in Node without native `EventSource`) to yield a stream of events (`AsyncGenerator` or returning an `EventEmitter`).
- **Step 3:** Refactor `waitForContractAction` to use this SSE endpoint under the hood if available, falling back to polling if the server does not support it.
- **Step 4:** Add a similar `watchDeposit(paymentHash: string)` method to replace polling in `deposit()`.

---

## 4. Comprehensive Pagination

**Context:**  
`src/client.ts` has endpoints that return lists (`listOffers`, `listContracts`, `browseOffers`).

**Issue:**  
While the `getLedger` method supports `limit` and `offset`, methods like `listContracts` do not expose pagination controls in their TypeScript signatures despite being list methods.

**Recommendation:**  
Standardize pagination across all collection endpoints.

**Implementation Plan:**
- **Step 1:** In `src/types.ts`, define a standard `PaginationParams` interface containing `limit?: number; cursor?: string; offset?: number`.
- **Step 2:** Merge `PaginationParams` into `ListOffersParams` and the inline filters object for `listContracts` and `listContractActions`.
- **Step 3:** Update the `buildQuery` method (or inline URL construction) in `src/client.ts` to properly serialize `limit`, `cursor`, and `offset` into the query string.
- **Step 4:** Ensure the return types account for pagination metadata (e.g., returning `{ items: T[], next_cursor?: string }` instead of just `T[]`, requiring a minor breaking change or an explicit `.data` property).

---

## 5. Concurrency Control for Metered Usage

**Context:**  
`applyMeteredUsage` in `src/metered-escrow-contracts.ts` computes escrow burns purely in-memory, returning a new contract state.

**Issue:**  
If an agent handles many concurrent LLM inferences and attempts to log metered usage in parallel without explicit locking, they may produce conflicting contract states, losing usage events.

**Recommendation:**  
Introduce a queuing wrapper or explicit optimistic concurrency in the SDK to handle high-throughput parallel inference logging safely.

**Implementation Plan:**
- **Step 1:** Create a new class `MeteredUsageManager` (or similar) in `src/metered-escrow-contracts.ts` that wraps a `MeteredEscrowContract`.
- **Step 2:** Add an asynchronous queue inside `MeteredUsageManager` using a simple `Promise` chain.
- **Step 3:** Implement an `apply(usage: MeteredUsageInput)` method that pushes the usage application onto the queue, ensuring that `applyMeteredUsage` is called sequentially against the latest contract state.
- **Step 4:** Provide a `flush()` method if events need to be batched before sending to a backend, allowing safe concurrent usage logging for agents.

---

## 6. SDK Logging and Telemetry

**Context:**  
The SDK operates as a black box without emitting debug logs or exposing interceptors.

**Issue:**  
When an AI agent fails to fund a contract or gets a policy denial, diagnosing the exact HTTP payload or wallet policy evaluation context is difficult.

**Recommendation:**  
Add a customizable logger and request/response interceptors to trace API interactions.

**Implementation Plan:**
- **Step 1:** Define a `Logger` interface in `src/types.ts` with `debug`, `info`, `warn`, and `error` methods.
- **Step 2:** Add `logger?: Logger` to `L402AgentOptions`.
- **Step 3:** Inside the `request<T>` method in `src/client.ts`, log the outgoing request method, URL, and body (at `debug` level) and the incoming response status/body.
- **Step 4:** In `fundContract` and `evaluateContractFunding`, log the input context and the resulting `WalletPolicyDecision` and its reasons.
- **Step 5:** Allow users to pass `console` directly or a custom Winston/Pino logger to the `L402Agent`.
