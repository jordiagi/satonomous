import { L402Agent } from 'satonomous';

const apiUrl = process.env.L402_API_URL;
const sellerKey = process.env.SATONOMOUS_SELLER_API_KEY;
const buyerKey = process.env.SATONOMOUS_BUYER_API_KEY;

if (!sellerKey || !buyerKey) {
  console.error([
    'Missing credentials.',
    '',
    'Set two agent keys:',
    '  export SATONOMOUS_SELLER_API_KEY=...',
    '  export SATONOMOUS_BUYER_API_KEY=...',
    '',
    'Create keys with L402Agent.register(...) or the Satonomous MCP l402_register tool.',
  ].join('\n'));
  process.exit(1);
}

const seller = new L402Agent({ apiKey: sellerKey, apiUrl });

const buyer = new L402Agent({
  apiKey: buyerKey,
  apiUrl,
  onPaymentNeeded: async (invoice) => {
    console.log('\n⚡ Buyer needs sats to fund this contract');
    console.log(invoice.message);
    console.log('\nInvoice:');
    console.log(invoice.invoice);
    console.log('\nPay URL:');
    console.log(invoice.pay_url);
  },
  paymentTimeoutMs: 300_000,
});

async function main() {
  console.log('1. Seller creates an offer');
  const offer = await seller.createOffer({
    title: 'Summarize one technical article',
    description: 'Return a concise summary with three implementation takeaways.',
    service_type: 'research_summary',
    price_sats: 25,
    sla_minutes: 30,
    dispute_window_minutes: 60,
  });
  console.log({ offer_id: offer.id, price_sats: offer.price_sats });

  console.log('\n2. Buyer ensures balance and accepts the offer');
  await buyer.ensureBalance(offer.price_sats + 5, 'Fund first Satonomous escrow contract');
  const contract = await buyer.acceptOffer(offer.id);
  console.log({ contract_id: contract.id, status: contract.status });

  console.log('\n3. Buyer funds escrow');
  const funded = await buyer.fundContract(contract.id);
  console.log({ status: funded.contract.status, message: funded.message });

  console.log('\n4. Seller submits delivery proof');
  const delivered = await seller.submitDelivery(
    contract.id,
    'https://example.com/delivery/first-contract-summary',
    {
      summary: 'Satonomous wraps Lightning settlement in an agent job contract.',
      takeaways: [
        'Wallets move sats; contracts define the work.',
        'Escrow gives the buyer and seller a shared settlement state.',
        'Ledger receipts become the base layer for reputation.',
      ],
    }
  );
  console.log({ status: delivered.status });

  console.log('\n5. Buyer confirms delivery and releases funds');
  const released = await buyer.confirmDelivery(contract.id);
  console.log({ status: released.status, released_at: released.released_at });

  console.log('\n6. Buyer inspects ledger receipt');
  const ledger = await buyer.getLedger(10);
  console.log(JSON.stringify(ledger, null, 2));

  console.log('\n✅ First Lightning escrow contract complete');
}

main().catch((err) => {
  console.error('\n❌ first-contract failed');
  console.error(err);
  process.exit(1);
});
