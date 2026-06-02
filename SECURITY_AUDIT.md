# Satonomous Security Audit & Implementation Plans

This document outlines potential security vulnerabilities and risks identified in the `satonomous` TypeScript SDK, along with detailed implementation plans for other agents to execute.

---

## [SOLVED] 1. Lack of Cryptographic Request Signatures (Bearer Token Risk)

**Status:** Fixed 2026-06-01. Authenticated SDK requests now include `X-L402-Timestamp` and `X-L402-Signature` HMAC-SHA256 headers over method, path, timestamp, and JSON body. Gateway verification rejects invalid/stale signatures and includes `REQUIRE_L402_SIGNATURES=1` for strict rejection of unsigned secret-key requests once all clients have upgraded.

**Context:**  
`src/client.ts` uses an `apiKey` which is sent as a plain HTTP header (`X-L402-Key`). The SDK acts as a gateway client for agents interacting with L402 contracts.

**Issue:**  
While HTTPS protects the token in transit, passing it as a static bearer token means it is vulnerable to interception (e.g., via server logs, MITM proxies, or database leaks) and subsequent replay attacks. For financial operations, this is insufficient.

**Recommendation:**  
Implement HMAC-SHA256 request signing using the API key as the secret, covering the request method, path, timestamp, and body.

**Implementation Plan:**
- **Step 1:** Modify the `L402Agent` constructor in `src/client.ts` to expect an API key. 
- **Step 2:** In the `request<T>` method in `src/client.ts`, capture the current timestamp: `const timestamp = Date.now().toString()`.
- **Step 3:** Construct a signing string: `${method}\n${path}\n${timestamp}\n${body ? JSON.stringify(body) : ''}`.
- **Step 4:** Generate an HMAC-SHA256 hash of the signing string using the `apiKey` as the secret via `node:crypto`.
- **Step 5:** Append headers `X-L402-Signature` and `X-L402-Timestamp` alongside `X-L402-Key`.
- **Step 6:** Update the backend mock/docs to mention the signature verification (not necessarily within the SDK code, but comment it).

---

## [SOLVED] 2. Integer Overflow & Precision Loss in Pricing Math

**Status:** Fixed 2026-05-31. Metered pricing, token-count checks, escrow recomputation, and contract verification now use `BigInt` intermediates and reject unsafe JS integers before they can round billing amounts.

**Context:**  
`src/metered-escrow-contracts.ts` calculates sats usage costs using `ceilingDiv` and multiplication of standard JS `number` types.

**Issue:**  
JavaScript `number` is a double-precision float. The calculation `usage.inputTokens * contract.pricing.input_sats` can easily exceed `Number.MAX_SAFE_INTEGER` if token limits or prices are high, leading to silent precision loss and inaccurate billing.

**Recommendation:**  
Migrate the arithmetic in `quoteMeteredUsage` and related functions to use `BigInt`.

**Implementation Plan:**
- **Step 1:** Open `src/metered-escrow-contracts.ts` and modify `ceilingDiv` to accept and return `bigint`: 
  `function ceilingDiv(numerator: bigint, denominator: bigint): bigint`.
- **Step 2:** Refactor `pricingDenominator` to return a `bigint` (e.g., `1_000_000n`).
- **Step 3:** In `quoteMeteredUsage`, convert inputs to `BigInt` before multiplication: `BigInt(usage.inputTokens) * BigInt(contract.pricing.input_sats)`.
- **Step 4:** Safely cast the resulting `bigint` back to `number` ONLY if they are guaranteed to fit within safe integer limits (e.g., for the final `total_sats`), or update the type definitions in `src/types.ts` to expect `number` but do math safely internally. Alternatively, just ensure the intermediate calculation uses `BigInt`.

---

## [SOLVED] 3. Unverified Cryptographic Signatures

**Status:** Fixed 2026-05-31. `seller_signed_usage` now requires a base64 Ed25519 seller signature and PEM public key; the signature is verified over a canonical metered usage payload before escrow is charged, and stored usage events are rechecked during contract verification.

**Context:**  
`applyMeteredUsage` in `src/metered-escrow-contracts.ts` takes a usage event which can contain a `sellerSignature`.

**Issue:**  
The SDK does not actually verify the `sellerSignature`. It simply creates a `MeteredUsageEvent` and burns escrow funds based on trust in the payload.

**Recommendation:**  
Implement signature verification before accepting a usage event with a seller signature.

**Implementation Plan:**
- **Step 1:** Add a helper function in `src/metered-escrow-contracts.ts` or a new `crypto.ts` utility to verify ECDSA/Schnorr signatures using `node:crypto`.
- **Step 2:** In `applyMeteredUsage`, check if `contract.metering.method === 'seller_signed_usage'`.
- **Step 3:** If required, serialize the usage payload (request ID, token counts, sats, etc.) into a canonical message.
- **Step 4:** Extract the seller's public key (this may need to be added to `contract.seller_agent_id` lookup or passed in).
- **Step 5:** Verify the `usage.sellerSignature` against the canonical message. If invalid, push an `invalid_signature` error code to `codes` and reject the application.

---

## [SOLVED] 4. Prototype Pollution and Unvalidated Input Spreading

**Status:** Fixed 2026-06-01. `createOffer()` now builds an explicit allowlisted POST body with only `title`, `description`, `price_sats`, `service_type`, and normalized `terms`. Regression coverage verifies that unexpected fields such as `active`, `seller_tenant_id`, `admin`, and `__proto__` are not sent.

**Context:**  
`src/client.ts` exports `createOffer(params: CreateOfferParams)`.

**Issue:**  
It uses `const { sla_minutes, dispute_window_minutes, ...rest } = params;` and then passes `...rest` directly into the HTTP POST body. If `params` contains prototype pollution payloads or unexpected administrative flags, the backend might process them.

**Recommendation:**  
Explicitly destructure and pick only the known, safe properties to form the request body.

**Implementation Plan:**
- **Step 1:** In `src/client.ts`, locate `createOffer(params: CreateOfferParams)`.
- **Step 2:** Instead of spreading `...rest`, explicitly map properties: `title`, `description`, `price_sats`, `service_type`.
- **Step 3:** Construct the JSON payload strictly: `const payload = { title: params.title, description: params.description, price_sats: params.price_sats, service_type: params.service_type, terms: { ... } }`.
- **Step 4:** Apply this practice to any other methods doing spread parameter passing into HTTP bodies.

---

## [SOLVED] 5. Brittle Canonical JSON Hashing

**Status:** Fixed 2026-06-01. Shared canonical JSON hashing now lives in `src/canonical-json.ts` and is used by ContractReceipts, ServiceCards, TokenServiceCards, WalletPolicies, MeteredEscrowContracts, and seller-signed metered usage payloads. It uses deterministic key ordering without `localeCompare`, omits optional `undefined` object fields, and rejects non-JSON values such as `NaN`, `Infinity`, `bigint`, functions, symbols, unsupported array entries, and non-plain objects.

**Context:**  
`src/metered-escrow-contracts.ts` relies on a custom `canonicalize` function that sorts object keys and then applies `JSON.stringify()`.

**Issue:**  
`JSON.stringify` serialization is environment-dependent (e.g., escaping rules, formatting of numbers like `1.0` vs `1`). Hashes may not match when communicating between different environments or languages.

**Recommendation:**  
Use a robust serialization library designed for deterministic hashing, such as RFC 8785 canonical JSON logic or stringifying explicit tuples.

**Implementation Plan:**
- **Step 1:** Install or implement a strict RFC 8785 compliant canonicalizer (or a fast minimal version for JS primitives).
- **Step 2:** In `src/metered-escrow-contracts.ts`, replace the custom `canonicalize` logic.
- **Step 3:** Ensure that floating point numbers are strictly formatted (or ideally, converted to strings/integers before hashing) so that the `sha256` function produces perfectly deterministic outputs regardless of the JS engine.
