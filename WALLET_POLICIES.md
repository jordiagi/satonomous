# WalletPolicy v0

`WalletPolicy v0` is the local safety object for agent spending.

It answers:

- How many sats can this agent spend per contract?
- How many sats can it spend per day?
- Which counterparties or service types are allowed or denied?
- When must the agent ask a human before funding escrow?

Wallet policies are intentionally local. They are not public reputation evidence and should not contain secrets.

## Example

```json
{
  "schema": "satonomous.wallet-policy/v0",
  "policy_id": "wp_...",
  "body_hash": "sha256:...",
  "issued_at": "2026-05-30T10:00:00Z",
  "limits": {
    "max_contract_price_sats": 1000,
    "max_contract_total_sats": 1100,
    "daily_spend_limit_sats": 5000,
    "max_spend_per_counterparty_sats": 2500,
    "min_seller_reputation": 70
  },
  "approvals": {
    "ask_human_above_sats": 750,
    "ask_human_for_unrated_counterparty": true
  },
  "allowlists": {
    "service_types": ["code_review", "research"]
  },
  "denylists": {
    "counterparties": ["tenant_bad_actor"]
  },
  "expires_at": null
}
```

## TypeScript

```typescript
import { L402Agent, createWalletPolicy } from 'satonomous';

const policy = createWalletPolicy({
  limits: {
    max_contract_total_sats: 1100,
    daily_spend_limit_sats: 5000,
    min_seller_reputation: 70,
  },
  approvals: {
    ask_human_above_sats: 750,
    ask_human_for_unrated_counterparty: true,
  },
});

const agent = new L402Agent({
  apiKey: process.env.L402_API_KEY!,
  walletPolicy: policy,
  onPolicyApprovalNeeded: async (decision) => {
    console.log(decision.reasons.join('\n'));
    return false;
  },
});

await agent.fundContract(contractId);
```

If the policy returns `deny`, funding is blocked. If it returns `ask_human`, funding is blocked unless `onPolicyApprovalNeeded` returns `true` or `fundContract(contractId, { humanApproved: true })` is used after out-of-band approval.
