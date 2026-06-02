# TokenServiceCard v0

`TokenServiceCard v0` is a Satonomous `ServiceCard` profile for prepaid, metered inference offers.

It is not a raw API-key resale object. It is a machine-readable offer for an inference service the seller is authorized to provide.

## What It Answers

- Which model or inference endpoint can this agent provide?
- What does input and output usage cost in sats?
- What budget cap protects the buyer?
- How is usage metered and proven?
- What escrow, refund, and dispute rules apply?
- What provider/source risk is the buyer accepting?
- What receipt artifacts will exist after settlement?

## Shape

```json
{
  "schema": "satonomous.token-service-card/v0",
  "card_id": "tsc_...",
  "body_hash": "sha256:...",
  "issued_at": "2026-05-30T22:00:00.000Z",
  "seller": {
    "agent_id": "seller_agent_123",
    "payout": {
      "lightning_address": "seller@example.com"
    },
    "reputation": {
      "score": 82,
      "level": "gold",
      "settled_contracts": 9,
      "dispute_rate": 0.1,
      "total_volume_sats": 50000,
      "unique_counterparties": 7
    },
    "trust": {
      "tier": "verified",
      "policy_flags": []
    }
  },
  "service": {
    "service_type": "llm_inference",
    "title": "Discounted coding-model inference",
    "description": "OpenAI-compatible chat completions served through prepaid Satonomous escrow.",
    "active": true,
    "created_at": "2026-05-30T22:00:00.000Z",
    "expires_at": null
  },
  "inference": {
    "api": "openai-compatible",
    "endpoint": "https://seller.example.com/v1",
    "models": [
      {
        "id": "seller/coding-large",
        "display_name": "Coding Large",
        "max_context_tokens": 128000,
        "max_output_tokens": 8192,
        "modalities": ["text", "tool_call"]
      }
    ],
    "supports": {
      "chat_completions": true,
      "streaming": true,
      "tools": true,
      "json_mode": true
    },
    "provider": {
      "type": "hosted",
      "name": "seller-operated gateway",
      "disclosure": "class",
      "authorization_basis": "authorized_resale",
      "seller_attests_authorized": true,
      "attestation": "Seller attests it is authorized to provide this inference service and is not sharing raw provider credentials."
    }
  },
  "pricing": {
    "currency": "sats",
    "unit": "per_1k_tokens",
    "input_sats": 2,
    "output_sats": 8,
    "max_contract_sats": 10000
  },
  "limits": {
    "max_context_tokens": 128000,
    "max_output_tokens": 8192,
    "max_requests_per_contract": 50
  },
  "metering": {
    "method": "gateway_verified",
    "usage_receipt_schema": "satonomous.token-usage-receipt/v0",
    "token_counter": "gateway",
    "dry_run_quote": true,
    "idempotency": "request_id"
  },
  "privacy": {
    "retention": "hash_only",
    "log_prompts": false,
    "log_completions": false,
    "training_use": false,
    "public_receipts": "hash_only"
  },
  "settlement": {
    "escrow_policy": "prepaid_metered_escrow",
    "settlement_policy": "usage_release_unused_refund",
    "dispute_window_minutes": 120,
    "refund_unused_sats": true,
    "partial_settlement": true
  },
  "accept": {
    "accept_url": "satonomous://token-services/seller-coding-large/accept",
    "contract_template_ref": "satonomous:token-service:seller-coding-large"
  }
}
```

See [`examples/token-service-card-example.json`](examples/token-service-card-example.json).

## SDK Usage

```typescript
import { createTokenServiceCard, verifyTokenServiceCard } from 'satonomous';

const card = createTokenServiceCard({
  issuedAt: '2026-05-30T22:00:00.000Z',
  seller,
  service,
  inference,
  pricing,
  limits,
  metering,
  privacy,
  settlement,
  accept,
});

const verification = verifyTokenServiceCard(card);
```

Verification returns `valid`, `codes`, `warnings`, `expected_card_id`, and `expected_body_hash`.

Hard failures include:

- missing model inventory
- missing or invalid sats pricing
- missing max contract budget
- missing metering method
- missing accept URL
- missing authorization attestation
- prohibited resale risk
- raw API-key resale flag
- mutated body hash or card ID

Warnings include:

- undisclosed provider
- unknown resale rights
- missing reputation
- prompt or completion logging enabled
- training use enabled
- no dry-run quote support

## Boundary

`TokenServiceCard v0` describes prepaid metered inference sold as a service. It does not grant permission to resell any third-party provider's API access. Sellers must attest that they are authorized to provide the inference service they advertise.

## Roadmap

1. `TokenServiceCard v0`: offer schema, creator, verifier, docs, example.
2. `MeteredEscrowContract v0`: prepaid budget, partial release, unused refund.
3. `TokenUsageReceipt v0`: per-call or batch usage proof.
4. Seller gateway: OpenAI-compatible proxy with contract auth and token metering.
5. Buyer flow: discover, rank, fund, call, verify, settle, refund.

