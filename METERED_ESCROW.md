# MeteredEscrowContract v0

`MeteredEscrowContract v0` is the prepaid accounting layer for token resale.

The flow is intentionally narrow:

1. A seller publishes a `TokenServiceCard`.
2. A buyer funds a maximum sats budget into escrow.
3. Each inference request creates one signed or gateway-verified usage event.
4. The contract burns escrow down by deterministic token pricing.
5. Unused sats stay refundable; disputed sats stay locked.

This is the safe Satonomous framing for discounted inference: prepaid metered contracts, not shared API keys.

## Invariants

- every debit maps to exactly one `request_id`
- duplicate `request_id` values are rejected
- usage cannot exceed the prepaid escrow amount
- usage cannot exceed context/output/request limits
- spend is recomputed from usage events
- final refund math is exact in sats
- `contract_id` is derived from immutable terms
- `body_hash` changes when mutable contract state changes

## Example

```ts
import {
  applyMeteredUsage,
  createMeteredEscrowContract,
  createTokenServiceCard,
  verifyMeteredEscrowContract,
} from 'satonomous';

const card = createTokenServiceCard(tokenServiceCardOptions);

const contract = createMeteredEscrowContract({
  tokenServiceCard: card,
  buyerAgentId: 'buyer_agent_456',
  escrowedSats: 10_000,
});

const result = applyMeteredUsage(contract, {
  requestId: 'req_001',
  modelId: 'seller/coding-large',
  inputTokens: 1_000,
  outputTokens: 250,
  promptHash: 'sha256:redacted-prompt',
  completionHash: 'sha256:redacted-completion',
});

if (!result.applied) {
  throw new Error(result.codes.join(', '));
}

console.log(result.contract.escrow.spent_sats);
console.log(verifyMeteredEscrowContract(result.contract));
```

## Statuses

- `accepted`: terms exist, not yet funded
- `funded`: prepaid escrow exists and usage can begin
- `active`: at least one usage event has been charged
- `exhausted`: escrow has been fully consumed
- `completed`: seller settlement and unused refund can be finalized
- `refunded`: contract closed with buyer refund
- `disputed`: disputed sats are locked
- `resolved`: dispute is resolved
- `expired`: contract expired

## Pricing

Pricing is inherited from the `TokenServiceCard`.

`per_1k_tokens` divides token charges by 1,000.
`per_1m_tokens` divides token charges by 1,000,000.

Satonomous rounds token charges up to the nearest whole sat. If a request minimum is configured, it applies only when the raw token charge is positive but below the minimum.

## Verification Codes

`verifyMeteredEscrowContract()` returns `valid` or one or more failure codes:

- `unsupported_schema`
- `missing_contract_id`
- `missing_terms_hash`
- `missing_body_hash`
- `terms_hash_mismatch`
- `body_hash_mismatch`
- `contract_id_mismatch`
- `missing_token_service_card_ref`
- `invalid_status`
- `invalid_price`
- `invalid_escrow_amount`
- `spend_exceeds_escrow`
- `usage_sum_mismatch`
- `refund_math_mismatch`
- `duplicate_request_id`
- `invalid_usage_event`
- `invalid_expiry`
