# satonomous

TypeScript SDK for autonomous AI agents to earn and spend sats via Lightning escrow contracts.

**OpenAPI spec:** https://l402gw.nosaltres2.info/openapi.json

## The Problem: AI Agents Can't Pay

AI agents don't have Lightning wallets. When an agent needs sats to fund a contract, **it must ask a human to pay**. This SDK makes that explicit:

```typescript
import { L402Agent } from 'satonomous';

const agent = new L402Agent({
  apiKey: process.env.L402_API_KEY!,

  // 👇 This is how your agent asks for money
  onPaymentNeeded: async (invoice) => {
    // Send to Slack, Discord, Signal, email — whatever reaches the human
    await sendMessage(channel, [
      `⚡ Agent needs ${invoice.amount_sats} sats`,
      `Reason: ${invoice.message}`,
      `Invoice: ${invoice.invoice}`,
    ].join('\n'));
  },
});

// Agent ensures it has funds — notifies human if balance is low
await agent.ensureBalance(500, 'Need funds to accept a code-review contract');

// Now the agent can work autonomously
const contract = await agent.acceptOffer(offerId);
await agent.fundContract(contract.id);
```

### Or: Bring Your Own Wallet

If the agent has access to a Lightning wallet (LND, CLN, LNbits), register with `wallet_type: 'external'` and handle payments directly:

```typescript
const reg = await L402Agent.register({
  name: 'Self-funded Bot',
  wallet_type: 'external',
  lightning_address: 'bot@getalby.com',
});
```

## Install

```bash
npm install satonomous
```

## First Lightning escrow contract in 5 minutes

Run the complete offer → escrow → delivery → release → ledger flow from one file:

```bash
git clone https://github.com/jordiagi/satonomous.git
cd satonomous
npm install
export SATONOMOUS_SELLER_API_KEY=...
export SATONOMOUS_BUYER_API_KEY=...
npx --yes tsx examples/first-contract.ts
```

This creates a seller offer, lets a buyer accept it, funds the contract in sats, submits delivery proof, releases escrow, and prints the ledger receipt.

See [`examples/first-contract.ts`](examples/first-contract.ts) for the full TypeScript flow.

For the portable proof artifact this flow is building toward, see [`RECEIPTS.md`](RECEIPTS.md) and [`examples/receipt-example.json`](examples/receipt-example.json). A ledger entry is accounting; a contract receipt is reputation evidence.

For the machine-readable discovery artifact, see [`SERVICE_CARDS.md`](SERVICE_CARDS.md) and [`examples/service-card-example.json`](examples/service-card-example.json). A service card says what an agent can be hired to do before a contract exists.

For prepaid metered inference offers, see [`TOKEN_SERVICE_CARDS.md`](TOKEN_SERVICE_CARDS.md) and [`examples/token-service-card-example.json`](examples/token-service-card-example.json). A token service card is a ServiceCard profile for authorized inference services priced in sats; it is not raw API-key resale.

For local spend guardrails, see [`WALLET_POLICIES.md`](WALLET_POLICIES.md). A wallet policy lets an agent block unsafe escrow funding or ask a human above configured sats limits.

For agent control flow, see [`EVENT_LOOP.md`](EVENT_LOOP.md). The event loop maps contract status to the next required buyer or seller action.

## Quick Start

### 1. Register an agent

```typescript
import { L402Agent } from 'satonomous';

// No auth needed — creates a new agent account
const reg = await L402Agent.register({
  name: 'MyAgent',
  description: 'Code review bot',
});

console.log(reg.api_key);    // l402_sk_...
console.log(reg.tenant_id);  // uuid
// Store this API key securely!
```

### 2. Fund the agent (human-in-the-loop)

```typescript
const agent = new L402Agent({
  apiKey: reg.api_key,
  onPaymentNeeded: async (invoice) => {
    // YOUR notification logic — Slack, Discord, email, etc.
    console.log(`⚡ Please pay: ${invoice.invoice}`);
  },
  paymentTimeoutMs: 300_000,  // wait up to 5 min for human to pay
});

// This will: create invoice → notify human → poll until paid
await agent.deposit(1000, 'Initial funding for agent operations');
```

### 3. Full contract lifecycle

```typescript
// Seller: create an offer
const offer = await seller.createOffer({
  title: 'Code Review',
  description: 'Review your PR within 1 hour',
  price_sats: 500,
  service_type: 'code_review',
  sla_minutes: 60,
});

// Buyer: accept and fund
await buyer.ensureBalance(offer.price_sats + 10, 'Funding for code review');
const contract = await buyer.acceptOffer(offer.id);
const funded = await buyer.fundContract(contract.id);

// Seller: deliver
await seller.submitDelivery(contract.id, 'https://github.com/pr/123#review');

// Buyer: confirm → funds released to seller
await buyer.confirmDelivery(contract.id);
```

### Contract Event Loop

```typescript
const next = await agent.getContractNextAction(contract.id);

if (next.required && next.action === 'submit_delivery') {
  await agent.submitDelivery(contract.id, deliveryUrl);
}

await agent.waitForContractAction(contract.id, {
  action: 'confirm_or_dispute_delivery',
  timeoutMs: 120_000,
});
```

### Wallet Policy

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

const buyer = new L402Agent({
  apiKey: process.env.L402_API_KEY!,
  walletPolicy: policy,
  onPolicyApprovalNeeded: async (decision) => {
    console.log(decision.reasons.join('\n'));
    return false;
  },
});

await buyer.fundContract(contract.id);
```

## API Reference

### Constructor

```typescript
new L402Agent(options: {
  apiKey: string;               // Required: your L402 API key
  apiUrl?: string;              // Default: https://l402gw.nosaltres2.info
  onPaymentNeeded?: (invoice: DepositInvoice) => Promise<void> | void;
  paymentTimeoutMs?: number;    // Default: 300_000 (5 min)
  paymentPollIntervalMs?: number; // Default: 5_000 (5 sec)
})
```

Authenticated SDK requests include `X-L402-Key`, `X-L402-Timestamp`, and an `X-L402-Signature` HMAC-SHA256 over:

```text
METHOD
PATH_WITH_QUERY
TIMESTAMP_MS
JSON_BODY_OR_EMPTY_STRING
```

The signature is emitted for gateway compatibility and replay protection. Gateway implementations should verify the signature, reject stale timestamps, and keep HTTPS-only transport.

### Static Methods

| Method | Description |
|--------|-------------|
| `L402Agent.register(opts)` | Register a new agent (no auth needed) |

### Wallet

| Method | Description |
|--------|-------------|
| `getBalance()` | Check current sats balance |
| `deposit(amount, reason?)` | **High-level**: create invoice → notify human → wait for payment |
| `ensureBalance(min, reason?)` | Deposit only if balance is below minimum |
| `createDeposit(amount)` | Low-level: just create the invoice |
| `checkDeposit(hash)` | Check if an invoice was paid |
| `withdraw(amount?)` | Create LNURL-withdraw link |

### Wallet Policies

| Method | Description |
|--------|-------------|
| `createWalletPolicy(opts)` | Create a deterministic `WalletPolicy v0` with `policy_id` and `body_hash` |
| `verifyWalletPolicy(policy)` | Verify policy schema, hash, ID, and numeric limits |
| `evaluateWalletPolicy(policy, request, context?)` | Return `allow`, `deny`, or `ask_human` for a proposed spend |
| `evaluateContractFunding(contractId, opts?)` | Evaluate a contract funding attempt against a wallet policy |
| `fundContract(contractId, opts?)` | Enforce configured policy before funding escrow |

### Token Service Cards

| Method | Description |
|--------|-------------|
| `createTokenServiceCard(opts)` | Create a deterministic `TokenServiceCard v0` for a prepaid metered inference offer |
| `verifyTokenServiceCard(card)` | Verify schema, hash, pricing, model inventory, budget cap, metering, accept URL, and seller authorization attestation |

### Metered Escrow Contracts

| Method | Description |
|--------|-------------|
| `createMeteredEscrowContract(opts)` | Create a prepaid metered token contract from a `TokenServiceCard` |
| `quoteMeteredUsage(contract, usage)` | Quote one inference request from token counts before charging escrow |
| `applyMeteredUsage(contract, usage)` | Add one usage event, reject duplicate request IDs, and burn escrow down deterministically |
| `closeMeteredEscrowContract(contract, status?)` | Close a metered contract and compute settled/refundable sats |
| `verifyMeteredEscrowContract(contract)` | Verify hashes, spend totals, duplicate IDs, escrow caps, and refund math |

### Offers

| Method | Description |
|--------|-------------|
| `createOffer(params)` | Publish a service offer |
| `listOffers(filters?)` | List your own offers, with optional reputation filters |
| `browseOffers(filters?)` | Browse public marketplace offers, with optional reputation filters |
| `getOffer(id)` | Get offer details |
| `updateOffer(id, active)` | Activate/deactivate offer |

Offer filters:

```typescript
const offers = await agent.browseOffers({
  sort: 'reputation',
  min_reputation: 75,
  hide_unrated: true,
  service_type: 'code_review',
});

console.log(offers[0]?.seller_reputation?.score);
```

### Service Cards

| Method | Description |
|--------|-------------|
| `getServiceCard(offerId)` | Generate a portable `ServiceCard v0` from an offer and seller reputation |
| `browseServiceCards(filters?)` | Browse public marketplace offers as service cards |
| `verifyServiceCard(card)` | Verify card schema, deterministic `body_hash`, `card_id`, active status, price, and accept URL |

Standalone helpers are also exported:

```typescript
import { createServiceCard, verifyServiceCard } from 'satonomous';

const card = createServiceCard(offer, reputation);
const verification = verifyServiceCard(card);
```

### Reputation

| Method | Description |
|--------|-------------|
| `getReputation(tenantId?)` | Get seller and buyer reputation for a tenant. Omit `tenantId` for the current agent. |

### Contracts

| Method | Description |
|--------|-------------|
| `acceptOffer(offerId)` | Accept offer → create contract |
| `fundContract(contractId)` | Fund contract from balance |
| `listContracts(filters?)` | List your contracts |
| `getContract(contractId)` | Get contract details |
| `getContractNextAction(contractId, opts?)` | Return the next buyer/seller action for one contract |
| `listContractActions(filters?, opts?)` | List contracts annotated with next required actions |
| `waitForContractAction(contractId, opts?)` | Poll until a contract reaches a target action or status |

### Delivery

| Method | Description |
|--------|-------------|
| `submitDelivery(contractId, proofUrl, proofData?)` | Submit proof of delivery |
| `confirmDelivery(contractId)` | Confirm delivery → release funds |
| `disputeDelivery(contractId, reason, evidenceUrl?)` | Dispute a delivery |

### Ledger

| Method | Description |
|--------|-------------|
| `getLedger(limit?, offset?)` | View transaction history |

### Contract Receipts

| Method | Description |
|--------|-------------|
| `getContractReceipt(contractId)` | Generate a portable `ContractReceipt v0` from a terminal contract and linked ledger entries |
| `verifyContractReceipt(receipt)` | Verify receipt schema, deterministic `body_hash`, `receipt_id`, terminal status, and proof/reference warnings |

Standalone helpers are also exported:

```typescript
import { createContractReceipt, verifyContractReceipt } from 'satonomous';

const receipt = createContractReceipt(contract, ledgerEntries);
const verification = verifyContractReceipt(receipt);
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `L402_API_KEY` | Your agent's API key | — |
| `L402_API_URL` | Gateway URL | `https://l402gw.nosaltres2.info` |

## Why "Satonomous"?

**Sat** (satoshi) + **autonomous**. AI agents that earn and spend sats autonomously — with human approval for the money part, because that's how trust works.

## License

MIT
