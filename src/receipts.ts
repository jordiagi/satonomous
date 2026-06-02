import { sha256Canonical } from './canonical-json.js';
import type {
  Contract,
  ContractReceipt,
  ContractReceiptEvidenceRef,
  ContractReceiptOutcome,
  ContractReceiptVerificationCode,
  ContractReceiptVerificationResult,
  CreateContractReceiptOptions,
  LedgerEntry,
} from './types.js';

const RECEIPT_SCHEMA = 'satonomous.contract-receipt/v0' as const;
const TERMINAL_STATUSES = new Set(['released', 'disputed', 'refunded']);

function receiptBody(receipt: ContractReceipt): Omit<ContractReceipt, 'receipt_id' | 'body_hash'> {
  const { receipt_id: _receiptId, body_hash: _bodyHash, ...body } = receipt;
  return body;
}

function completeReceipt(receipt: ContractReceipt): ContractReceipt {
  const body_hash = sha256Canonical(receiptBody(receipt));
  return {
    ...receipt,
    body_hash,
    receipt_id: `cr_${body_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`,
  };
}

function termsSnapshot(contract: Contract): Record<string, any> {
  return contract.terms_snapshot && typeof contract.terms_snapshot === 'object'
    ? contract.terms_snapshot
    : {};
}

function deliveryProof(contract: Contract): Record<string, any> {
  return contract.delivery_proof && typeof contract.delivery_proof === 'object'
    ? contract.delivery_proof
    : {};
}

function normalizeOutcome(status: string): ContractReceiptOutcome {
  if (status === 'released' || status === 'disputed' || status === 'refunded') return status;
  throw new Error(`ContractReceipt requires terminal contract status: released, disputed, or refunded. Got ${status}.`);
}

function defaultIssuedAt(contract: Contract, outcome: ContractReceiptOutcome): string {
  if (outcome === 'released' && contract.released_at) return contract.released_at;
  if (outcome === 'disputed' && contract.disputed_at) return contract.disputed_at;
  return contract.completed_at ?? contract.funded_at ?? contract.accepted_at ?? contract.created_at;
}

function defaultLedgerRefs(contract: Contract, ledgerEntries: LedgerEntry[]): string[] {
  return Array.from(
    new Set(
      ledgerEntries
        .filter((entry) => entry.reference_id === contract.id)
        .map((entry) => String(entry.reference_id))
    )
  );
}

function defaultEvidenceRefs(contract: Contract, proof: Record<string, any>): ContractReceiptEvidenceRef[] {
  const refs: ContractReceiptEvidenceRef[] = [];
  const uri = typeof proof.url === 'string' ? proof.url : typeof proof.proof_url === 'string' ? proof.proof_url : null;
  const hash =
    typeof proof.payload_hash === 'string'
      ? proof.payload_hash
      : typeof proof.hash === 'string'
        ? proof.hash
        : null;

  if (uri || hash) {
    refs.push({
      kind: 'delivery',
      uri: uri ?? undefined,
      hash: hash ?? undefined,
      submitted_by: contract.seller_tenant_id,
      submitted_at: contract.completed_at ?? undefined,
      redaction_status: 'none',
    });
  }

  return refs;
}

export function createContractReceipt(
  contract: Contract,
  ledgerEntries: LedgerEntry[] = [],
  options: CreateContractReceiptOptions = {}
): ContractReceipt {
  const outcome = normalizeOutcome(contract.status);
  const terms = termsSnapshot(contract);
  const proof = deliveryProof(contract);
  const proofUrl =
    typeof proof.url === 'string' ? proof.url : typeof proof.proof_url === 'string' ? proof.proof_url : null;
  const payloadHash =
    typeof proof.payload_hash === 'string'
      ? proof.payload_hash
      : typeof proof.hash === 'string'
        ? proof.hash
        : null;
  const evidenceRefs = options.evidenceRefs ?? defaultEvidenceRefs(contract, proof);

  return completeReceipt({
    schema: RECEIPT_SCHEMA,
    receipt_id: '',
    body_hash: '',
    issued_at: options.issuedAt ?? defaultIssuedAt(contract, outcome),
    contract: {
      id: contract.id,
      offer_id: contract.offer_id,
      service_type: typeof terms.service_type === 'string' ? terms.service_type : null,
      buyer_agent_id: contract.buyer_tenant_id,
      seller_agent_id: contract.seller_tenant_id,
      price_sats: contract.price_sats,
      fee_sats: contract.fee_sats,
      settlement_rail: 'lightning',
      status: contract.status,
    },
    terms: {
      title: typeof terms.title === 'string' ? terms.title : null,
      description: typeof terms.description === 'string' ? terms.description : null,
      sla_minutes: typeof terms.sla_minutes === 'number' ? terms.sla_minutes : null,
      dispute_window_minutes:
        typeof terms.dispute_window_minutes === 'number' ? terms.dispute_window_minutes : null,
      ...terms,
    },
    delivery_proof: {
      url: proofUrl,
      payload_hash: payloadHash,
      submitted_at: contract.completed_at,
    },
    evidence_refs: evidenceRefs,
    settlement: {
      outcome,
      released_at: contract.released_at,
      disputed_at: contract.disputed_at,
      refunded_at: options.refundedAt ?? null,
      ledger_reference_ids: defaultLedgerRefs(contract, ledgerEntries),
    },
    reputation_event: {
      seller_effect:
        outcome === 'released'
          ? 'completed_contract'
          : outcome === 'disputed'
            ? 'disputed_contract'
            : 'refunded_contract',
      buyer_effect:
        outcome === 'released'
          ? 'released_contract'
          : outcome === 'disputed'
            ? 'disputed_contract'
            : 'refunded_contract',
      counts_toward_reputation: outcome === 'released',
    },
    links: options.links,
  });
}

export function verifyContractReceipt(receipt: ContractReceipt): ContractReceiptVerificationResult {
  const codes: ContractReceiptVerificationCode[] = [];
  const warnings: ContractReceiptVerificationCode[] = [];

  if (receipt.schema !== RECEIPT_SCHEMA) codes.push('unsupported_schema');
  if (!receipt.receipt_id) codes.push('missing_receipt_id');
  if (!receipt.body_hash) codes.push('missing_body_hash');
  if (!TERMINAL_STATUSES.has(receipt.contract?.status)) codes.push('non_terminal_contract_status');
  if (!receipt.settlement?.outcome) codes.push('missing_settlement_outcome');

  const expected_body_hash = sha256Canonical(receiptBody(receipt));
  const expected_receipt_id = `cr_${expected_body_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`;

  if (receipt.body_hash && receipt.body_hash !== expected_body_hash) codes.push('body_hash_mismatch');
  if (receipt.receipt_id && receipt.receipt_id !== expected_receipt_id) codes.push('receipt_id_mismatch');

  if (!receipt.delivery_proof?.url && !receipt.delivery_proof?.payload_hash) {
    warnings.push('missing_delivery_proof');
  }
  if (!receipt.settlement?.ledger_reference_ids?.length) {
    warnings.push('missing_ledger_reference');
  }
  for (const ref of receipt.evidence_refs ?? []) {
    if (!ref.kind || (!ref.uri && !ref.hash)) warnings.push('invalid_evidence_ref');
  }

  return {
    valid: codes.length === 0,
    codes: codes.length ? codes : ['valid'],
    warnings,
    expected_receipt_id,
    expected_body_hash,
  };
}
