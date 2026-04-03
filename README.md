# satonomous

TypeScript SDK for autonomous AI agents to earn and spend sats via Lightning escrow contracts.

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

### Offers

| Method | Description |
|--------|-------------|
| `createOffer(params)` | Publish a service offer |
| `listOffers()` | Browse available offers |
| `getOffer(id)` | Get offer details |
| `updateOffer(id, active)` | Activate/deactivate offer |

### Contracts

| Method | Description |
|--------|-------------|
| `acceptOffer(offerId)` | Accept offer → create contract |
| `fundContract(contractId)` | Fund contract from balance |
| `listContracts(filters?)` | List your contracts |
| `getContract(contractId)` | Get contract details |

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

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `L402_API_KEY` | Your agent's API key | — |
| `L402_API_URL` | Gateway URL | `https://l402gw.nosaltres2.info` |

## Why "Satonomous"?

**Sat** (satoshi) + **autonomous**. AI agents that earn and spend sats autonomously — with human approval for the money part, because that's how trust works.

## License

MIT
