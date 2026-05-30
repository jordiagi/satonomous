import type {
  Contract,
  ContractActionOptions,
  ContractNextAction,
  ContractNextActionCode,
  ContractRole,
} from './types.js';

const TERMINAL_STATUSES = new Set(['released', 'refunded', 'expired']);

function termsSnapshot(contract: Contract): Record<string, any> {
  return contract.terms_snapshot && typeof contract.terms_snapshot === 'object'
    ? contract.terms_snapshot
    : {};
}

function addMinutes(iso: string | null, minutes: number | null): string | null {
  if (!iso || minutes === null) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return new Date(time + minutes * 60_000).toISOString();
}

function isOverdue(dueAt: string | null, now: string): boolean {
  if (!dueAt) return false;
  const due = Date.parse(dueAt);
  const current = Date.parse(now);
  return Number.isFinite(due) && Number.isFinite(current) && current > due;
}

function requiredFor(role: ContractRole, actor: ContractRole | 'none'): boolean {
  return actor !== 'none' && role === actor;
}

function buildAction(params: {
  contract: Contract;
  role: ContractRole;
  actor: ContractRole | 'none';
  action: ContractNextActionCode;
  terminal?: boolean;
  reason: string;
  dueAt?: string | null;
  now: string;
}): ContractNextAction {
  const terms = termsSnapshot(params.contract);
  return {
    contract_id: params.contract.id,
    offer_id: params.contract.offer_id,
    status: params.contract.status,
    role: params.role,
    actor: params.actor,
    action: params.action,
    required: requiredFor(params.role, params.actor),
    terminal: params.terminal ?? false,
    reason: params.reason,
    price_sats: params.contract.price_sats,
    fee_sats: params.contract.fee_sats,
    service_type: typeof terms.service_type === 'string' ? terms.service_type : null,
    due_at: params.dueAt ?? null,
    overdue: isOverdue(params.dueAt ?? null, params.now),
    contract: params.contract,
  };
}

export function getContractNextAction(
  contract: Contract,
  options: ContractActionOptions = {}
): ContractNextAction {
  const role = options.role ?? 'observer';
  const now = options.now ?? new Date().toISOString();
  const terms = termsSnapshot(contract);
  const slaMinutes = typeof terms.sla_minutes === 'number' ? terms.sla_minutes : null;
  const disputeWindowMinutes =
    typeof terms.dispute_window_minutes === 'number' ? terms.dispute_window_minutes : null;

  if (contract.status === 'accepted') {
    const actor = contract.funded_at ? 'seller' : 'buyer';
    return buildAction({
      contract,
      role,
      actor,
      action: actor === 'buyer' ? 'fund_contract' : 'submit_delivery',
      reason: actor === 'buyer'
        ? 'Contract is accepted and needs buyer escrow funding.'
        : 'Contract appears funded and needs seller delivery.',
      now,
    });
  }

  if (contract.status === 'funded') {
    const dueAt = addMinutes(contract.funded_at, slaMinutes);
    return buildAction({
      contract,
      role,
      actor: 'seller',
      action: role === 'buyer' ? 'wait_for_delivery' : 'submit_delivery',
      reason: 'Escrow is funded and seller delivery is required.',
      dueAt,
      now,
    });
  }

  if (contract.status === 'completed') {
    const dueAt = addMinutes(contract.completed_at, disputeWindowMinutes);
    return buildAction({
      contract,
      role,
      actor: 'buyer',
      action: role === 'seller' ? 'wait_for_buyer_review' : 'confirm_or_dispute_delivery',
      reason: 'Seller delivered proof; buyer should confirm release or open a dispute.',
      dueAt,
      now,
    });
  }

  if (contract.status === 'disputed') {
    return buildAction({
      contract,
      role,
      actor: 'none',
      action: 'review_dispute',
      reason: 'Contract is disputed and awaiting gateway/operator resolution.',
      now,
    });
  }

  if (TERMINAL_STATUSES.has(contract.status)) {
    return buildAction({
      contract,
      role,
      actor: 'none',
      action: 'terminal_receipt_available',
      terminal: true,
      reason: 'Contract is terminal; generate a ContractReceipt for reputation evidence.',
      now,
    });
  }

  return buildAction({
    contract,
    role,
    actor: 'none',
    action: 'unknown_status',
    reason: `No event-loop rule is defined for contract status "${contract.status}".`,
    now,
  });
}
