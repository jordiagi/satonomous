// src/receipts.ts
import { createHash } from "crypto";
var RECEIPT_SCHEMA = "satonomous.contract-receipt/v0";
var TERMINAL_STATUSES = /* @__PURE__ */ new Set(["released", "disputed", "refunded"]);
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize(entry)])
  );
}
function sha256(value) {
  const json = JSON.stringify(canonicalize(value));
  return `sha256:${createHash("sha256").update(json).digest("hex")}`;
}
function receiptBody(receipt) {
  const { receipt_id: _receiptId, body_hash: _bodyHash, ...body } = receipt;
  return body;
}
function completeReceipt(receipt) {
  const body_hash = sha256(receiptBody(receipt));
  return {
    ...receipt,
    body_hash,
    receipt_id: `cr_${body_hash.slice("sha256:".length, "sha256:".length + 32)}`
  };
}
function termsSnapshot(contract) {
  return contract.terms_snapshot && typeof contract.terms_snapshot === "object" ? contract.terms_snapshot : {};
}
function deliveryProof(contract) {
  return contract.delivery_proof && typeof contract.delivery_proof === "object" ? contract.delivery_proof : {};
}
function normalizeOutcome(status) {
  if (status === "released" || status === "disputed" || status === "refunded") return status;
  throw new Error(`ContractReceipt requires terminal contract status: released, disputed, or refunded. Got ${status}.`);
}
function defaultIssuedAt(contract, outcome) {
  if (outcome === "released" && contract.released_at) return contract.released_at;
  if (outcome === "disputed" && contract.disputed_at) return contract.disputed_at;
  return contract.completed_at ?? contract.funded_at ?? contract.accepted_at ?? contract.created_at;
}
function defaultLedgerRefs(contract, ledgerEntries) {
  return Array.from(
    new Set(
      ledgerEntries.filter((entry) => entry.reference_id === contract.id).map((entry) => String(entry.reference_id))
    )
  );
}
function defaultEvidenceRefs(contract, proof) {
  const refs = [];
  const uri = typeof proof.url === "string" ? proof.url : typeof proof.proof_url === "string" ? proof.proof_url : null;
  const hash = typeof proof.payload_hash === "string" ? proof.payload_hash : typeof proof.hash === "string" ? proof.hash : null;
  if (uri || hash) {
    refs.push({
      kind: "delivery",
      uri: uri ?? void 0,
      hash: hash ?? void 0,
      submitted_by: contract.seller_tenant_id,
      submitted_at: contract.completed_at ?? void 0,
      redaction_status: "none"
    });
  }
  return refs;
}
function createContractReceipt(contract, ledgerEntries = [], options = {}) {
  const outcome = normalizeOutcome(contract.status);
  const terms = termsSnapshot(contract);
  const proof = deliveryProof(contract);
  const proofUrl = typeof proof.url === "string" ? proof.url : typeof proof.proof_url === "string" ? proof.proof_url : null;
  const payloadHash = typeof proof.payload_hash === "string" ? proof.payload_hash : typeof proof.hash === "string" ? proof.hash : null;
  const evidenceRefs = options.evidenceRefs ?? defaultEvidenceRefs(contract, proof);
  return completeReceipt({
    schema: RECEIPT_SCHEMA,
    receipt_id: "",
    body_hash: "",
    issued_at: options.issuedAt ?? defaultIssuedAt(contract, outcome),
    contract: {
      id: contract.id,
      offer_id: contract.offer_id,
      service_type: typeof terms.service_type === "string" ? terms.service_type : null,
      buyer_agent_id: contract.buyer_tenant_id,
      seller_agent_id: contract.seller_tenant_id,
      price_sats: contract.price_sats,
      fee_sats: contract.fee_sats,
      settlement_rail: "lightning",
      status: contract.status
    },
    terms: {
      title: typeof terms.title === "string" ? terms.title : null,
      description: typeof terms.description === "string" ? terms.description : null,
      sla_minutes: typeof terms.sla_minutes === "number" ? terms.sla_minutes : null,
      dispute_window_minutes: typeof terms.dispute_window_minutes === "number" ? terms.dispute_window_minutes : null,
      ...terms
    },
    delivery_proof: {
      url: proofUrl,
      payload_hash: payloadHash,
      submitted_at: contract.completed_at
    },
    evidence_refs: evidenceRefs,
    settlement: {
      outcome,
      released_at: contract.released_at,
      disputed_at: contract.disputed_at,
      refunded_at: options.refundedAt ?? null,
      ledger_reference_ids: defaultLedgerRefs(contract, ledgerEntries)
    },
    reputation_event: {
      seller_effect: outcome === "released" ? "completed_contract" : outcome === "disputed" ? "disputed_contract" : "refunded_contract",
      buyer_effect: outcome === "released" ? "released_contract" : outcome === "disputed" ? "disputed_contract" : "refunded_contract",
      counts_toward_reputation: outcome === "released"
    },
    links: options.links
  });
}
function verifyContractReceipt(receipt) {
  const codes = [];
  const warnings = [];
  if (receipt.schema !== RECEIPT_SCHEMA) codes.push("unsupported_schema");
  if (!receipt.receipt_id) codes.push("missing_receipt_id");
  if (!receipt.body_hash) codes.push("missing_body_hash");
  if (!TERMINAL_STATUSES.has(receipt.contract?.status)) codes.push("non_terminal_contract_status");
  if (!receipt.settlement?.outcome) codes.push("missing_settlement_outcome");
  const expected_body_hash = sha256(receiptBody(receipt));
  const expected_receipt_id = `cr_${expected_body_hash.slice("sha256:".length, "sha256:".length + 32)}`;
  if (receipt.body_hash && receipt.body_hash !== expected_body_hash) codes.push("body_hash_mismatch");
  if (receipt.receipt_id && receipt.receipt_id !== expected_receipt_id) codes.push("receipt_id_mismatch");
  if (!receipt.delivery_proof?.url && !receipt.delivery_proof?.payload_hash) {
    warnings.push("missing_delivery_proof");
  }
  if (!receipt.settlement?.ledger_reference_ids?.length) {
    warnings.push("missing_ledger_reference");
  }
  for (const ref of receipt.evidence_refs ?? []) {
    if (!ref.kind || !ref.uri && !ref.hash) warnings.push("invalid_evidence_ref");
  }
  return {
    valid: codes.length === 0,
    codes: codes.length ? codes : ["valid"],
    warnings,
    expected_receipt_id,
    expected_body_hash
  };
}

// src/service-cards.ts
import { createHash as createHash2 } from "crypto";
var SERVICE_CARD_SCHEMA = "satonomous.service-card/v0";
function canonicalize2(value) {
  if (Array.isArray(value)) return value.map(canonicalize2);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize2(entry)])
  );
}
function sha2562(value) {
  const json = JSON.stringify(canonicalize2(value));
  return `sha256:${createHash2("sha256").update(json).digest("hex")}`;
}
function serviceCardBody(card) {
  const { card_id: _cardId, body_hash: _bodyHash, ...body } = card;
  return body;
}
function completeServiceCard(card) {
  const body_hash = sha2562(serviceCardBody(card));
  return {
    ...card,
    body_hash,
    card_id: `sc_${body_hash.slice("sha256:".length, "sha256:".length + 32)}`
  };
}
function offerTerms(offer) {
  return offer.terms && typeof offer.terms === "object" ? offer.terms : {};
}
function normalizeReputation(offer, reputation) {
  if (reputation?.seller) {
    return {
      score: reputation.seller.score,
      level: reputation.seller.level,
      settled_contracts: reputation.seller.summary.settled_contracts,
      dispute_rate: reputation.seller.summary.dispute_rate,
      total_volume_sats: reputation.seller.summary.total_volume_sats,
      unique_counterparties: reputation.seller.summary.unique_counterparties
    };
  }
  if (offer.seller_reputation) {
    return {
      score: offer.seller_reputation.score,
      level: offer.seller_reputation.level,
      settled_contracts: offer.seller_reputation.settled_contracts,
      dispute_rate: offer.seller_reputation.dispute_rate,
      total_volume_sats: offer.seller_reputation.total_volume_sats,
      unique_counterparties: offer.seller_reputation.unique_counterparties
    };
  }
  return null;
}
function defaultProofRequirements(terms, options) {
  if (options.proofRequirements) return options.proofRequirements;
  if (Array.isArray(terms.proof_requirements)) {
    return terms.proof_requirements.map(String).filter(Boolean);
  }
  if (typeof terms.proof_requirement === "string") return [terms.proof_requirement];
  return ["delivery_proof_url_or_payload_hash"];
}
function createServiceCard(offer, reputation, options = {}) {
  const terms = offerTerms(offer);
  return completeServiceCard({
    schema: SERVICE_CARD_SCHEMA,
    card_id: "",
    body_hash: "",
    issued_at: options.issuedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    seller: {
      agent_id: offer.seller_tenant_id,
      reputation: normalizeReputation(offer, reputation)
    },
    service: {
      offer_id: offer.id,
      service_type: offer.service_type,
      title: offer.title,
      description: offer.description,
      price_sats: offer.price_sats,
      currency: "sats",
      active: Boolean(offer.active),
      created_at: offer.created_at,
      expires_at: offer.expires_at
    },
    terms: {
      sla_minutes: typeof terms.sla_minutes === "number" ? terms.sla_minutes : null,
      dispute_window_minutes: typeof terms.dispute_window_minutes === "number" ? terms.dispute_window_minutes : null,
      max_concurrent_contracts: offer.max_concurrent_contracts,
      escrow_policy: "lightning_escrow",
      settlement_policy: "release_dispute_refund",
      proof_required: typeof terms.proof_required === "boolean" ? terms.proof_required : true,
      proof_requirements: defaultProofRequirements(terms, options),
      ...terms
    },
    accept: {
      accept_url: options.acceptUrl ?? `satonomous://offers/${encodeURIComponent(offer.id)}/accept`,
      contract_template_ref: options.contractTemplateRef ?? `satonomous:offer:${offer.id}`
    },
    links: options.links
  });
}
function verifyServiceCard(card) {
  const codes = [];
  const warnings = [];
  if (card.schema !== SERVICE_CARD_SCHEMA) codes.push("unsupported_schema");
  if (!card.card_id) codes.push("missing_card_id");
  if (!card.body_hash) codes.push("missing_body_hash");
  if (!card.service?.active) codes.push("inactive_offer");
  if (!card.accept?.accept_url) codes.push("missing_accept_url");
  if (!card.service?.price_sats || card.service.price_sats <= 0) codes.push("missing_price");
  const expected_body_hash = sha2562(serviceCardBody(card));
  const expected_card_id = `sc_${expected_body_hash.slice("sha256:".length, "sha256:".length + 32)}`;
  if (card.body_hash && card.body_hash !== expected_body_hash) codes.push("body_hash_mismatch");
  if (card.card_id && card.card_id !== expected_card_id) codes.push("card_id_mismatch");
  if (!card.terms?.sla_minutes) warnings.push("missing_sla");
  const rep = card.seller?.reputation;
  if (rep && (rep.score < 0 || rep.score > 100 || !rep.level)) warnings.push("invalid_reputation");
  return {
    valid: codes.length === 0,
    codes: codes.length ? codes : ["valid"],
    warnings,
    expected_card_id,
    expected_body_hash
  };
}

// src/wallet-policies.ts
import { createHash as createHash3 } from "crypto";
var WALLET_POLICY_SCHEMA = "satonomous.wallet-policy/v0";
function canonicalize3(value) {
  if (Array.isArray(value)) return value.map(canonicalize3);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize3(entry)])
  );
}
function sha2563(value) {
  const json = JSON.stringify(canonicalize3(value));
  return `sha256:${createHash3("sha256").update(json).digest("hex")}`;
}
function policyBody(policy) {
  const { policy_id: _policyId, body_hash: _bodyHash, ...body } = policy;
  return body;
}
function completeWalletPolicy(policy) {
  const body_hash = sha2563(policyBody(policy));
  return {
    ...policy,
    body_hash,
    policy_id: `wp_${body_hash.slice("sha256:".length, "sha256:".length + 32)}`
  };
}
function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function pushReason(codes, reasons, code, reason) {
  codes.push(code);
  reasons.push(reason);
}
function unique(values) {
  const cleaned = Array.from(new Set((values ?? []).map(String).filter(Boolean)));
  return cleaned.length ? cleaned : void 0;
}
function createWalletPolicy(options = {}) {
  return completeWalletPolicy({
    schema: WALLET_POLICY_SCHEMA,
    policy_id: "",
    body_hash: "",
    issued_at: options.issuedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    agent_id: options.agentId,
    limits: options.limits ?? {},
    approvals: options.approvals ?? {},
    allowlists: {
      service_types: unique(options.allowlists?.service_types),
      counterparties: unique(options.allowlists?.counterparties)
    },
    denylists: {
      service_types: unique(options.denylists?.service_types),
      counterparties: unique(options.denylists?.counterparties)
    },
    expires_at: options.expiresAt ?? null,
    notes: options.notes
  });
}
function verifyWalletPolicy(policy) {
  const codes = [];
  if (policy.schema !== WALLET_POLICY_SCHEMA) codes.push("unsupported_schema");
  if (!policy.policy_id) codes.push("missing_policy_id");
  if (!policy.body_hash) codes.push("missing_body_hash");
  const expected_body_hash = sha2563(policyBody(policy));
  const expected_policy_id = `wp_${expected_body_hash.slice("sha256:".length, "sha256:".length + 32)}`;
  if (policy.body_hash && policy.body_hash !== expected_body_hash) codes.push("body_hash_mismatch");
  if (policy.policy_id && policy.policy_id !== expected_policy_id) codes.push("policy_id_mismatch");
  for (const value of [
    policy.limits?.max_contract_price_sats,
    policy.limits?.max_contract_total_sats,
    policy.limits?.daily_spend_limit_sats,
    policy.limits?.max_spend_per_counterparty_sats,
    policy.approvals?.ask_human_above_sats
  ]) {
    if (value !== void 0 && !isNonNegativeNumber(value)) codes.push("invalid_limit");
  }
  const minRep = policy.limits?.min_seller_reputation;
  if (minRep !== void 0 && (!isNonNegativeNumber(minRep) || minRep > 100)) {
    codes.push("invalid_reputation_threshold");
  }
  return {
    valid: codes.length === 0,
    codes: codes.length ? codes : ["valid"],
    expected_policy_id,
    expected_body_hash
  };
}
function evaluateWalletPolicy(policy, request, context = {}) {
  const denies = [];
  const asks = [];
  const reasons = [];
  const amount = request.amount_sats;
  const price = request.price_sats ?? amount;
  const total = (request.price_sats ?? amount) + (request.fee_sats ?? 0);
  const verification = verifyWalletPolicy(policy);
  if (!verification.valid) {
    pushReason(denies, reasons, "invalid_policy", `WalletPolicy failed verification: ${verification.codes.join(", ")}`);
  }
  if (policy.expires_at && Date.parse(policy.expires_at) <= Date.parse(context.now ?? (/* @__PURE__ */ new Date()).toISOString())) {
    pushReason(denies, reasons, "deny_policy_expired", `WalletPolicy expired at ${policy.expires_at}`);
  }
  const limits = policy.limits ?? {};
  if (limits.max_contract_price_sats !== void 0 && price > limits.max_contract_price_sats) {
    pushReason(
      denies,
      reasons,
      "deny_amount_exceeds_contract_price_limit",
      `${price} sats price exceeds max_contract_price_sats ${limits.max_contract_price_sats}`
    );
  }
  if (limits.max_contract_total_sats !== void 0 && total > limits.max_contract_total_sats) {
    pushReason(
      denies,
      reasons,
      "deny_amount_exceeds_contract_total_limit",
      `${total} sats total exceeds max_contract_total_sats ${limits.max_contract_total_sats}`
    );
  }
  if (limits.daily_spend_limit_sats !== void 0 && (context.daily_spent_sats ?? 0) + amount > limits.daily_spend_limit_sats) {
    pushReason(
      denies,
      reasons,
      "deny_daily_spend_limit",
      `${(context.daily_spent_sats ?? 0) + amount} sats would exceed daily_spend_limit_sats ${limits.daily_spend_limit_sats}`
    );
  }
  if (limits.max_spend_per_counterparty_sats !== void 0 && (context.counterparty_spent_sats ?? 0) + amount > limits.max_spend_per_counterparty_sats) {
    pushReason(
      denies,
      reasons,
      "deny_counterparty_spend_limit",
      `${(context.counterparty_spent_sats ?? 0) + amount} sats would exceed max_spend_per_counterparty_sats ${limits.max_spend_per_counterparty_sats}`
    );
  }
  const counterparty = request.counterparty_tenant_id;
  const deniedCounterparties = policy.denylists?.counterparties ?? [];
  const allowedCounterparties = policy.allowlists?.counterparties ?? [];
  if (counterparty && deniedCounterparties.includes(counterparty)) {
    pushReason(denies, reasons, "deny_counterparty_denied", `${counterparty} is in the counterparty denylist`);
  }
  if (counterparty && allowedCounterparties.length > 0 && !allowedCounterparties.includes(counterparty)) {
    pushReason(denies, reasons, "deny_counterparty_not_allowed", `${counterparty} is not in the counterparty allowlist`);
  }
  const serviceType = request.service_type ?? void 0;
  const deniedServices = policy.denylists?.service_types ?? [];
  const allowedServices = policy.allowlists?.service_types ?? [];
  if (serviceType && deniedServices.includes(serviceType)) {
    pushReason(denies, reasons, "deny_service_type_denied", `${serviceType} is in the service type denylist`);
  }
  if (serviceType && allowedServices.length > 0 && !allowedServices.includes(serviceType)) {
    pushReason(denies, reasons, "deny_service_type_not_allowed", `${serviceType} is not in the service type allowlist`);
  }
  if (limits.min_seller_reputation !== void 0 && context.seller_reputation_score !== void 0 && context.seller_reputation_score !== null && context.seller_reputation_score < limits.min_seller_reputation) {
    pushReason(
      denies,
      reasons,
      "deny_min_seller_reputation",
      `${context.seller_reputation_score} seller reputation is below minimum ${limits.min_seller_reputation}`
    );
  }
  const approvals = policy.approvals ?? {};
  if (approvals.ask_human_above_sats !== void 0 && amount > approvals.ask_human_above_sats) {
    pushReason(
      asks,
      reasons,
      "ask_human_amount_above_threshold",
      `${amount} sats exceeds ask_human_above_sats ${approvals.ask_human_above_sats}`
    );
  }
  if (approvals.ask_human_for_unrated_counterparty && (context.seller_reputation_score === void 0 || context.seller_reputation_score === null)) {
    pushReason(asks, reasons, "ask_human_unrated_counterparty", "seller reputation is unavailable");
  }
  if (denies.length > 0) {
    return {
      decision: "deny",
      codes: denies,
      reasons,
      amount_sats: amount,
      policy_id: policy.policy_id
    };
  }
  if (asks.length > 0) {
    return {
      decision: "ask_human",
      codes: asks,
      reasons,
      amount_sats: amount,
      policy_id: policy.policy_id
    };
  }
  return {
    decision: "allow",
    codes: ["allowed"],
    reasons: ["WalletPolicy allows this spend"],
    amount_sats: amount,
    policy_id: policy.policy_id
  };
}

// src/contract-actions.ts
var TERMINAL_STATUSES2 = /* @__PURE__ */ new Set(["released", "refunded", "expired"]);
function termsSnapshot2(contract) {
  return contract.terms_snapshot && typeof contract.terms_snapshot === "object" ? contract.terms_snapshot : {};
}
function addMinutes(iso, minutes) {
  if (!iso || minutes === null) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return new Date(time + minutes * 6e4).toISOString();
}
function isOverdue(dueAt, now) {
  if (!dueAt) return false;
  const due = Date.parse(dueAt);
  const current = Date.parse(now);
  return Number.isFinite(due) && Number.isFinite(current) && current > due;
}
function requiredFor(role, actor) {
  return actor !== "none" && role === actor;
}
function buildAction(params) {
  const terms = termsSnapshot2(params.contract);
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
    service_type: typeof terms.service_type === "string" ? terms.service_type : null,
    due_at: params.dueAt ?? null,
    overdue: isOverdue(params.dueAt ?? null, params.now),
    contract: params.contract
  };
}
function getContractNextAction(contract, options = {}) {
  const role = options.role ?? "observer";
  const now = options.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const terms = termsSnapshot2(contract);
  const slaMinutes = typeof terms.sla_minutes === "number" ? terms.sla_minutes : null;
  const disputeWindowMinutes = typeof terms.dispute_window_minutes === "number" ? terms.dispute_window_minutes : null;
  if (contract.status === "accepted") {
    const actor = contract.funded_at ? "seller" : "buyer";
    return buildAction({
      contract,
      role,
      actor,
      action: actor === "buyer" ? "fund_contract" : "submit_delivery",
      reason: actor === "buyer" ? "Contract is accepted and needs buyer escrow funding." : "Contract appears funded and needs seller delivery.",
      now
    });
  }
  if (contract.status === "funded") {
    const dueAt = addMinutes(contract.funded_at, slaMinutes);
    return buildAction({
      contract,
      role,
      actor: "seller",
      action: role === "buyer" ? "wait_for_delivery" : "submit_delivery",
      reason: "Escrow is funded and seller delivery is required.",
      dueAt,
      now
    });
  }
  if (contract.status === "completed") {
    const dueAt = addMinutes(contract.completed_at, disputeWindowMinutes);
    return buildAction({
      contract,
      role,
      actor: "buyer",
      action: role === "seller" ? "wait_for_buyer_review" : "confirm_or_dispute_delivery",
      reason: "Seller delivered proof; buyer should confirm release or open a dispute.",
      dueAt,
      now
    });
  }
  if (contract.status === "disputed") {
    return buildAction({
      contract,
      role,
      actor: "none",
      action: "review_dispute",
      reason: "Contract is disputed and awaiting gateway/operator resolution.",
      now
    });
  }
  if (TERMINAL_STATUSES2.has(contract.status)) {
    return buildAction({
      contract,
      role,
      actor: "none",
      action: "terminal_receipt_available",
      terminal: true,
      reason: "Contract is terminal; generate a ContractReceipt for reputation evidence.",
      now
    });
  }
  return buildAction({
    contract,
    role,
    actor: "none",
    action: "unknown_status",
    reason: `No event-loop rule is defined for contract status "${contract.status}".`,
    now
  });
}

// src/client.ts
var L402Error = class extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "L402Error";
    this.status = status;
    this.code = code;
  }
};
var L402Agent = class {
  constructor(options) {
    if (!options.apiKey) {
      throw new Error("apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl ?? "https://l402gw.nosaltres2.info";
    this.onPaymentNeeded = options.onPaymentNeeded;
    this.paymentTimeoutMs = options.paymentTimeoutMs ?? 3e5;
    this.paymentPollIntervalMs = options.paymentPollIntervalMs ?? 5e3;
    this.walletPolicy = options.walletPolicy;
    this.onPolicyApprovalNeeded = options.onPolicyApprovalNeeded;
  }
  async request(method, path, body, auth = true) {
    const url = `${this.apiUrl}${path}`;
    const headers = {
      "Content-Type": "application/json"
    };
    if (auth) {
      headers["X-L402-Key"] = this.apiKey;
    }
    const options = {
      method,
      headers
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      let errorCode;
      try {
        const data = await res.json();
        errorMsg = data.error || errorMsg;
        errorCode = data.code;
      } catch {
      }
      throw new L402Error(errorMsg, res.status, errorCode);
    }
    return res.json();
  }
  buildQuery(params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        query.append(key, String(value));
      }
    }
    const encoded = query.toString();
    return encoded ? `?${encoded}` : "";
  }
  // Static: register a new agent (no auth needed)
  static async register(options) {
    const apiUrl = options.apiUrl ?? "https://l402gw.nosaltres2.info";
    const url = `${apiUrl}/api/v1/agents/register`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: options.name,
        description: options.description,
        wallet_type: options.wallet_type ?? "custodial",
        lightning_address: options.lightning_address
      })
    });
    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        errorMsg = data.error || errorMsg;
      } catch {
      }
      throw new L402Error(errorMsg, res.status);
    }
    return res.json();
  }
  // Wallet
  async getBalance() {
    return this.request("GET", "/api/v1/wallet/balance");
  }
  /**
   * Low-level: create a deposit invoice. Returns the invoice for manual handling.
   * Most agents should use `deposit()` instead, which notifies the human and waits.
   */
  async createDeposit(amount_sats) {
    const result = await this.request("POST", "/api/v1/wallet/deposit", { amount_sats });
    return {
      ...result,
      pay_url: `lightning:${result.invoice}`
    };
  }
  /**
   * Check if a deposit invoice has been paid.
   */
  async checkDeposit(paymentHash) {
    return this.request("GET", `/api/v1/wallet/deposit/${paymentHash}`);
  }
  /**
   * High-level deposit: creates invoice, notifies human, waits for payment.
   *
   * WHY THIS EXISTS: AI agents don't have Lightning wallets. They can't pay
   * invoices. When an agent needs sats, it must ask a human to pay.
   *
   * This method:
   * 1. Creates a Lightning invoice for the requested amount
   * 2. Calls `onPaymentNeeded` so you can notify the human (chat, email, UI)
   * 3. Polls until the invoice is paid or times out
   * 4. Returns the confirmed deposit status
   *
   * If `onPaymentNeeded` is not configured, throws with the invoice so the
   * caller can handle notification manually.
   *
   * @param amount_sats - Amount to deposit
   * @param reason - Human-readable reason (shown in the notification)
   * @returns Confirmed deposit status
   * @throws {L402Error} if payment times out or fails
   *
   * @example
   * const agent = new L402Agent({
   *   apiKey: 'sk_...',
   *   onPaymentNeeded: async (invoice) => {
   *     // Send to Slack, Discord, Signal, email, etc.
   *     await notify(`Pay ${invoice.amount_sats} sats: ${invoice.invoice}`);
   *   },
   * });
   *
   * // Agent requests funding and waits
   * const deposit = await agent.deposit(1000, 'Need funds to accept code-review offer');
   * console.log(`Funded! Balance: ${deposit.amount_sats} sats`);
   */
  async deposit(amount_sats, reason) {
    const invoice = await this.createDeposit(amount_sats);
    if (!this.onPaymentNeeded) {
      throw new L402Error(
        `Payment needed: ${amount_sats} sats. Invoice: ${invoice.invoice}. No onPaymentNeeded callback configured \u2014 pay this invoice manually and call checkDeposit('${invoice.payment_hash}') to confirm.`,
        402,
        "PAYMENT_NEEDED"
      );
    }
    const enrichedInvoice = {
      ...invoice,
      message: [
        reason ? `\u26A1 Agent needs ${amount_sats} sats: ${reason}` : `\u26A1 Agent needs ${amount_sats} sats deposited`,
        "",
        `\u{1F4F1} Tap to pay: ${invoice.pay_url}`,
        "",
        `Or paste this invoice into any Lightning wallet:`,
        invoice.invoice
      ].join("\n")
    };
    await this.onPaymentNeeded(enrichedInvoice);
    if (this.paymentTimeoutMs === 0) {
      return { status: "pending", amount_sats, paid_at: null };
    }
    const deadline = Date.now() + this.paymentTimeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, this.paymentPollIntervalMs));
      const status = await this.checkDeposit(invoice.payment_hash);
      if (status.status === "paid") return status;
      if (status.status === "expired") {
        throw new L402Error("Deposit invoice expired before payment", 408, "PAYMENT_EXPIRED");
      }
    }
    throw new L402Error(
      `Payment not received within ${this.paymentTimeoutMs / 1e3}s. Invoice may still be valid \u2014 check with checkDeposit('${invoice.payment_hash}')`,
      408,
      "PAYMENT_TIMEOUT"
    );
  }
  /**
   * Ensure the agent has at least `minBalance` sats. If not, request a deposit.
   * Convenience method that checks balance first, then deposits the difference.
   *
   * @example
   * // Before accepting an offer, make sure you can pay
   * await agent.ensureBalance(500, 'Need funds for code-review contract');
   * await agent.fundContract(contractId);
   */
  async ensureBalance(minBalance, reason) {
    const current = await this.getBalance();
    if (current.balance_sats >= minBalance) return current;
    const needed = minBalance - current.balance_sats;
    await this.deposit(needed, reason ?? `Need ${needed} more sats (have ${current.balance_sats}, need ${minBalance})`);
    return this.getBalance();
  }
  async withdraw(amount_sats) {
    return this.request("POST", "/api/v1/wallet/withdraw", amount_sats ? { amount_sats } : {});
  }
  // Offers
  async createOffer(params) {
    const { sla_minutes, dispute_window_minutes, ...rest } = params;
    return this.request("POST", "/api/v1/offers", {
      ...rest,
      terms: {
        sla_minutes: sla_minutes ?? 30,
        dispute_window_minutes: dispute_window_minutes ?? 1440
      }
    });
  }
  async getTenant() {
    return this.request("GET", "/api/v1/tenants/me");
  }
  async getReputation(tenantId) {
    const id = tenantId ?? (await this.getTenant()).tenant_id;
    return this.request("GET", `/api/v1/reputation/${encodeURIComponent(id)}`);
  }
  async listOffers(filters) {
    const result = await this.request("GET", `/api/v1/offers${this.buildQuery(filters)}`);
    return result.offers || [];
  }
  async browseOffers(filters) {
    const result = await this.request(
      "GET",
      `/api/v1/offers${this.buildQuery(filters)}`,
      void 0,
      false
    );
    return result.offers || [];
  }
  async getOffer(offerId) {
    return this.request("GET", `/api/v1/offers/${offerId}`);
  }
  async getServiceCard(offerId, options) {
    const offer = await this.getOffer(offerId);
    let reputation = null;
    try {
      reputation = await this.getReputation(offer.seller_tenant_id);
    } catch {
      reputation = null;
    }
    return createServiceCard(offer, reputation, {
      links: {
        quickstart: "https://github.com/jordiagi/satonomous/blob/main/examples/first-contract.ts",
        offer: `${this.apiUrl}/api/v1/offers/${encodeURIComponent(offer.id)}`
      },
      ...options
    });
  }
  async browseServiceCards(filters, options) {
    const offers = await this.browseOffers(filters);
    return offers.map((offer) => createServiceCard(offer, null, options));
  }
  verifyServiceCard(card) {
    return verifyServiceCard(card);
  }
  async updateOffer(offerId, active) {
    return this.request("PATCH", `/api/v1/offers/${offerId}`, { active });
  }
  // Contracts
  async acceptOffer(offerId) {
    return this.request("POST", "/api/v1/contracts", { offer_id: offerId });
  }
  async fundContract(contractId, options = {}) {
    const policy = options.policy ?? this.walletPolicy;
    if (policy) {
      const decision = await this.evaluateContractFunding(contractId, { ...options, policy });
      if (decision.decision === "deny") {
        throw new L402Error(
          `WalletPolicy denied funding ${contractId}: ${decision.reasons.join("; ")}`,
          403,
          "WALLET_POLICY_DENIED"
        );
      }
      if (decision.decision === "ask_human" && !options.humanApproved) {
        const approved = await this.onPolicyApprovalNeeded?.(decision);
        if (approved !== true) {
          throw new L402Error(
            `WalletPolicy requires human approval for ${contractId}: ${decision.reasons.join("; ")}`,
            402,
            "WALLET_POLICY_APPROVAL_REQUIRED"
          );
        }
      }
    }
    return this.request("POST", `/api/v1/contracts/${contractId}/fund`, {});
  }
  async listContracts(filters) {
    let path = "/api/v1/contracts";
    const params = new URLSearchParams();
    if (filters?.role) params.append("role", filters.role);
    if (filters?.status) params.append("status", filters.status);
    if (params.toString()) path += "?" + params.toString();
    const result = await this.request("GET", path);
    return result.contracts || [];
  }
  async getContract(contractId) {
    return this.request("GET", `/api/v1/contracts/${contractId}`);
  }
  async inferRole(contract) {
    try {
      const tenant = await this.getTenant();
      if (tenant.tenant_id === contract.buyer_tenant_id) return "buyer";
      if (tenant.tenant_id === contract.seller_tenant_id) return "seller";
    } catch {
    }
    return "observer";
  }
  async getContractNextAction(contractId, options = {}) {
    const contract = await this.getContract(contractId);
    const role = options.role ?? await this.inferRole(contract);
    return getContractNextAction(contract, { ...options, role });
  }
  async listContractActions(filters, options = {}) {
    const contracts = await this.listContracts(filters);
    return Promise.all(
      contracts.map(async (contract) => {
        const role = options.role ?? await this.inferRole(contract);
        return getContractNextAction(contract, { ...options, role });
      })
    );
  }
  async waitForContractAction(contractId, options = {}) {
    const timeoutMs = options.timeoutMs ?? 6e4;
    const pollIntervalMs = options.pollIntervalMs ?? 5e3;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const next = await this.getContractNextAction(contractId, options);
      if ((!options.action || next.action === options.action) && (!options.status || next.status === options.status)) {
        return next;
      }
      if (next.terminal && !options.action && !options.status) return next;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    throw new L402Error(
      `Timed out waiting for contract ${contractId}${options.action ? ` action ${options.action}` : ""}${options.status ? ` status ${options.status}` : ""}`,
      408,
      "CONTRACT_WATCH_TIMEOUT"
    );
  }
  evaluateWalletPolicy(policy, request, context) {
    return evaluateWalletPolicy(policy, request, context);
  }
  async evaluateContractFunding(contractId, options = {}) {
    const policy = options.policy ?? this.walletPolicy;
    if (!policy) {
      throw new Error("No WalletPolicy configured. Pass options.policy or set walletPolicy in the constructor.");
    }
    const contract = await this.getContract(contractId);
    const terms = contract.terms_snapshot && typeof contract.terms_snapshot === "object" ? contract.terms_snapshot : {};
    const amount = contract.price_sats + contract.fee_sats;
    return evaluateWalletPolicy(
      policy,
      {
        amount_sats: amount,
        price_sats: contract.price_sats,
        fee_sats: contract.fee_sats,
        counterparty_tenant_id: contract.seller_tenant_id,
        service_type: typeof terms.service_type === "string" ? terms.service_type : null,
        offer_id: contract.offer_id,
        contract_id: contract.id,
        description: typeof terms.title === "string" ? terms.title : void 0
      },
      options.context
    );
  }
  // Delivery
  async submitDelivery(contractId, proofUrl, proofData) {
    return this.request("POST", `/api/v1/contracts/${contractId}/deliver`, {
      proof_url: proofUrl,
      proof_data: proofData
    });
  }
  async confirmDelivery(contractId) {
    return this.request("POST", `/api/v1/contracts/${contractId}/confirm`, {});
  }
  async disputeDelivery(contractId, reason, evidenceUrl) {
    return this.request("POST", `/api/v1/contracts/${contractId}/dispute`, {
      reason,
      evidence_url: evidenceUrl
    });
  }
  // Ledger
  async getLedger(limit, offset) {
    let path = "/api/v1/ledger";
    const params = new URLSearchParams();
    if (limit) params.append("limit", String(limit));
    if (offset) params.append("offset", String(offset));
    if (params.toString()) path += "?" + params.toString();
    return this.request("GET", path);
  }
  async getContractReceipt(contractId) {
    const contract = await this.getContract(contractId);
    const { entries } = await this.getLedger(100);
    return createContractReceipt(contract, entries, {
      links: {
        quickstart: "https://github.com/jordiagi/satonomous/blob/main/examples/first-contract.ts"
      }
    });
  }
  verifyContractReceipt(receipt) {
    return verifyContractReceipt(receipt);
  }
};

// src/token-service-cards.ts
import { createHash as createHash4 } from "crypto";
var TOKEN_SERVICE_CARD_SCHEMA = "satonomous.token-service-card/v0";
function canonicalize4(value) {
  if (Array.isArray(value)) return value.map(canonicalize4);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize4(entry)])
  );
}
function sha2564(value) {
  const json = JSON.stringify(canonicalize4(value));
  return `sha256:${createHash4("sha256").update(json).digest("hex")}`;
}
function tokenServiceCardBody(card) {
  const { card_id: _cardId, body_hash: _bodyHash, ...body } = card;
  return body;
}
function completeTokenServiceCard(card) {
  const body_hash = sha2564(tokenServiceCardBody(card));
  return {
    ...card,
    body_hash,
    card_id: `tsc_${body_hash.slice("sha256:".length, "sha256:".length + 32)}`
  };
}
function positive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function nonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function createTokenServiceCard(options) {
  return completeTokenServiceCard({
    schema: TOKEN_SERVICE_CARD_SCHEMA,
    card_id: "",
    body_hash: "",
    issued_at: options.issuedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    seller: options.seller,
    service: options.service,
    inference: options.inference,
    pricing: options.pricing,
    limits: options.limits,
    metering: {
      usage_receipt_schema: "satonomous.token-usage-receipt/v0",
      idempotency: "request_id",
      ...options.metering
    },
    privacy: options.privacy,
    settlement: {
      escrow_policy: "prepaid_metered_escrow",
      settlement_policy: "usage_release_unused_refund",
      ...options.settlement
    },
    accept: options.accept,
    links: options.links
  });
}
function verifyTokenServiceCard(card) {
  const codes = [];
  const warnings = [];
  if (card.schema !== TOKEN_SERVICE_CARD_SCHEMA) codes.push("unsupported_schema");
  if (!card.card_id) codes.push("missing_card_id");
  if (!card.body_hash) codes.push("missing_body_hash");
  if (!card.service?.active) codes.push("inactive_service");
  if (!card.accept?.accept_url) codes.push("missing_accept_url");
  const expected_body_hash = sha2564(tokenServiceCardBody(card));
  const expected_card_id = `tsc_${expected_body_hash.slice("sha256:".length, "sha256:".length + 32)}`;
  if (card.body_hash && card.body_hash !== expected_body_hash) codes.push("body_hash_mismatch");
  if (card.card_id && card.card_id !== expected_card_id) codes.push("card_id_mismatch");
  if (!Array.isArray(card.inference?.models) || card.inference.models.length === 0) {
    codes.push("missing_model");
  }
  if (!card.pricing) {
    codes.push("missing_pricing");
  } else {
    if (!nonNegative(card.pricing.input_sats) || !nonNegative(card.pricing.output_sats)) {
      codes.push("invalid_price");
    }
    if ((card.pricing.input_sats ?? 0) === 0 && (card.pricing.output_sats ?? 0) === 0) {
      codes.push("invalid_price");
    }
    if (card.pricing.cached_input_sats !== void 0 && !nonNegative(card.pricing.cached_input_sats)) {
      codes.push("invalid_price");
    }
    if (!positive(card.pricing.max_contract_sats)) codes.push("missing_budget_cap");
  }
  if (!positive(card.limits?.max_context_tokens) || !positive(card.limits?.max_output_tokens)) {
    codes.push("invalid_limit");
  }
  if (!card.metering?.method || !card.metering?.token_counter) {
    codes.push("missing_metering");
  }
  const provider = card.inference?.provider;
  if (!provider?.seller_attests_authorized || !provider.attestation) {
    codes.push("missing_authorization_attestation");
  }
  if (provider?.authorization_basis === "prohibited_risk") {
    codes.push("prohibited_resale_risk");
  }
  const policyFlags = card.seller?.trust?.policy_flags ?? [];
  if (policyFlags.includes("raw_api_key_resale")) codes.push("raw_credential_resale");
  if (provider?.disclosure === "undisclosed") warnings.push("undisclosed_provider");
  if (provider?.authorization_basis === "unknown") warnings.push("unknown_resale_rights");
  if (!card.settlement?.dispute_window_minutes) warnings.push("missing_sla");
  if (!card.seller?.reputation) warnings.push("missing_reputation");
  if (card.metering && !card.metering.dry_run_quote) warnings.push("no_dry_run_quote");
  if (card.privacy?.log_prompts) warnings.push("prompt_logging_enabled");
  if (card.privacy?.log_completions) warnings.push("completion_logging_enabled");
  if (card.privacy?.training_use) warnings.push("training_use_enabled");
  return {
    valid: codes.length === 0,
    codes: codes.length ? codes : ["valid"],
    warnings,
    expected_card_id,
    expected_body_hash
  };
}

// src/metered-escrow-contracts.ts
import { createHash as createHash5 } from "crypto";
var METERED_ESCROW_SCHEMA = "satonomous.metered-escrow-contract/v0";
var USAGE_EVENT_SCHEMA = "satonomous.token-usage-event/v0";
var SPENDABLE_STATUSES = /* @__PURE__ */ new Set(["funded", "active"]);
var TERMINAL_STATUSES3 = /* @__PURE__ */ new Set(["exhausted", "completed", "refunded", "resolved", "expired"]);
function canonicalize5(value) {
  if (Array.isArray(value)) return value.map(canonicalize5);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize5(entry)])
  );
}
function sha2565(value) {
  const json = JSON.stringify(canonicalize5(value));
  return `sha256:${createHash5("sha256").update(json).digest("hex")}`;
}
function positiveInteger(value) {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}
function nonNegativeInteger(value) {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}
function ceilingDiv(numerator, denominator) {
  return numerator === 0 ? 0 : Math.ceil(numerator / denominator);
}
function pricingDenominator(unit) {
  return unit === "per_1m_tokens" ? 1e6 : 1e3;
}
function contractTermsBody(contract) {
  return {
    schema: contract.schema,
    issued_at: contract.issued_at,
    token_service_card_id: contract.token_service_card_id,
    token_service_card_hash: contract.token_service_card_hash,
    buyer_agent_id: contract.buyer_agent_id,
    seller_agent_id: contract.seller_agent_id,
    pricing: contract.pricing,
    limits: contract.limits,
    metering: contract.metering,
    settlement: contract.settlement,
    escrowed_sats: contract.escrow.escrowed_sats,
    links: contract.links
  };
}
function contractBody(contract) {
  const { contract_id: _contractId, terms_hash: _termsHash, body_hash: _bodyHash, ...body } = contract;
  return body;
}
function usageEventBody(event) {
  const { event_id: _eventId, ...body } = event;
  return body;
}
function completeUsageEvent(event) {
  const eventHash = sha2565(usageEventBody(event));
  return {
    ...event,
    event_id: `tue_${eventHash.slice("sha256:".length, "sha256:".length + 32)}`
  };
}
function completeContract(contract) {
  const terms_hash = sha2565(contractTermsBody(contract));
  const contract_id = `mec_${terms_hash.slice("sha256:".length, "sha256:".length + 32)}`;
  const withIdentity = { ...contract, terms_hash, contract_id };
  return {
    ...withIdentity,
    body_hash: sha2565(contractBody(withIdentity))
  };
}
function recomputeEscrow(contract) {
  const spent_sats = contract.usage_events.reduce((sum, event) => sum + event.sats_charged, 0);
  const disputed_sats = contract.status === "disputed" ? spent_sats : contract.escrow.disputed_sats;
  const settled_sats = TERMINAL_STATUSES3.has(contract.status) && contract.status !== "refunded" ? spent_sats : contract.escrow.settled_sats;
  return {
    escrowed_sats: contract.escrow.escrowed_sats,
    spent_sats,
    refundable_sats: Math.max(0, contract.escrow.escrowed_sats - spent_sats - disputed_sats),
    settled_sats,
    disputed_sats
  };
}
function withEscrow(contract) {
  return completeContract({
    ...contract,
    escrow: recomputeEscrow(contract)
  });
}
function createMeteredEscrowContract(options) {
  const card = options.tokenServiceCard;
  const issuedAt = options.issuedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const expiresAt = options.expiresAt === void 0 && card.limits.expires_after_minutes ? new Date(new Date(issuedAt).getTime() + card.limits.expires_after_minutes * 6e4).toISOString() : options.expiresAt ?? card.service.expires_at;
  const contract = completeContract({
    schema: METERED_ESCROW_SCHEMA,
    contract_id: "",
    terms_hash: "",
    body_hash: "",
    issued_at: issuedAt,
    updated_at: options.updatedAt ?? issuedAt,
    token_service_card_id: card.card_id,
    token_service_card_hash: card.body_hash,
    buyer_agent_id: options.buyerAgentId,
    seller_agent_id: card.seller.agent_id,
    status: options.status ?? "funded",
    pricing: {
      currency: card.pricing.currency,
      unit: card.pricing.unit,
      input_sats: card.pricing.input_sats,
      output_sats: card.pricing.output_sats,
      cached_input_sats: card.pricing.cached_input_sats,
      request_minimum_sats: card.pricing.request_minimum_sats,
      max_contract_sats: card.pricing.max_contract_sats
    },
    limits: {
      max_context_tokens: card.limits.max_context_tokens,
      max_output_tokens: card.limits.max_output_tokens,
      max_requests_per_contract: card.limits.max_requests_per_contract,
      expires_after_minutes: card.limits.expires_after_minutes,
      expires_at: expiresAt
    },
    metering: {
      method: card.metering.method,
      token_counter: card.metering.token_counter,
      idempotency: card.metering.idempotency
    },
    escrow: {
      escrowed_sats: options.escrowedSats,
      spent_sats: 0,
      refundable_sats: options.escrowedSats,
      settled_sats: 0,
      disputed_sats: 0
    },
    settlement: {
      dispute_window_minutes: card.settlement.dispute_window_minutes,
      refund_unused_sats: card.settlement.refund_unused_sats,
      partial_settlement: card.settlement.partial_settlement
    },
    usage_events: [],
    links: options.links
  });
  const verification = verifyMeteredEscrowContract(contract);
  if (!verification.valid) {
    throw new Error(`Invalid metered escrow contract: ${verification.codes.join(", ")}`);
  }
  return contract;
}
function quoteMeteredUsage(contract, usage) {
  const denominator = pricingDenominator(contract.pricing.unit);
  const input_sats = ceilingDiv(usage.inputTokens * contract.pricing.input_sats, denominator);
  const output_sats = ceilingDiv(usage.outputTokens * contract.pricing.output_sats, denominator);
  const cached_input_sats = ceilingDiv(
    (usage.cachedInputTokens ?? 0) * (contract.pricing.cached_input_sats ?? contract.pricing.input_sats),
    denominator
  );
  const rawTotal = input_sats + output_sats + cached_input_sats;
  const minimum = contract.pricing.request_minimum_sats ?? 0;
  const minimum_applied_sats = rawTotal > 0 && rawTotal < minimum ? minimum - rawTotal : 0;
  const total_sats = rawTotal + minimum_applied_sats;
  const remaining_before_sats = Math.max(0, contract.escrow.escrowed_sats - contract.escrow.spent_sats - contract.escrow.disputed_sats);
  return {
    input_sats,
    output_sats,
    cached_input_sats,
    minimum_applied_sats,
    total_sats,
    remaining_before_sats,
    remaining_after_sats: remaining_before_sats - total_sats
  };
}
function applyMeteredUsage(contract, usage) {
  const codes = [];
  const reasons = [];
  if (!SPENDABLE_STATUSES.has(contract.status)) {
    codes.push("contract_not_spendable");
    reasons.push(`Contract status ${contract.status} cannot accept metered usage.`);
  }
  if (!usage.requestId || !usage.modelId || !nonNegativeInteger(usage.inputTokens) || !nonNegativeInteger(usage.outputTokens) || usage.cachedInputTokens !== void 0 && !nonNegativeInteger(usage.cachedInputTokens) || usage.inputTokens + usage.outputTokens + (usage.cachedInputTokens ?? 0) <= 0) {
    codes.push("invalid_usage");
    reasons.push("Usage must include request/model ids and non-negative token counts with at least one token.");
  }
  if (usage.inputTokens + (usage.cachedInputTokens ?? 0) > contract.limits.max_context_tokens) {
    codes.push("usage_exceeds_limits");
    reasons.push("Input token usage exceeds contract context limit.");
  }
  if (usage.outputTokens > contract.limits.max_output_tokens) {
    codes.push("usage_exceeds_limits");
    reasons.push("Output token usage exceeds contract output limit.");
  }
  if (contract.limits.max_requests_per_contract !== void 0 && contract.usage_events.length >= contract.limits.max_requests_per_contract) {
    codes.push("request_limit_exceeded");
    reasons.push("Contract request limit has already been reached.");
  }
  if (contract.usage_events.some((event2) => event2.request_id === usage.requestId)) {
    codes.push("duplicate_request_id");
    reasons.push("Request id has already been charged on this contract.");
  }
  const quote = quoteMeteredUsage(contract, usage);
  if (quote.total_sats <= 0) {
    codes.push("invalid_usage");
    reasons.push("Usage quote must produce a positive sats charge.");
  }
  if (quote.remaining_after_sats < 0) {
    codes.push("insufficient_escrow");
    reasons.push("Usage charge would exceed remaining prepaid escrow.");
  }
  if (codes.length > 0) {
    return { applied: false, codes, reasons, quote, contract };
  }
  const event = completeUsageEvent({
    schema: USAGE_EVENT_SCHEMA,
    event_id: "",
    request_id: usage.requestId,
    contract_id: contract.contract_id,
    created_at: usage.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    model_id: usage.modelId,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cached_input_tokens: usage.cachedInputTokens,
    sats_charged: quote.total_sats,
    metering_source: usage.meteringSource ?? contract.metering.method,
    seller_signature: usage.sellerSignature,
    buyer_acknowledged: usage.buyerAcknowledged,
    prompt_hash: usage.promptHash,
    completion_hash: usage.completionHash,
    metadata_hash: usage.metadataHash
  });
  const nextStatus = quote.remaining_after_sats === 0 ? "exhausted" : "active";
  const nextContract = withEscrow({
    ...contract,
    status: nextStatus,
    updated_at: event.created_at,
    usage_events: [...contract.usage_events, event]
  });
  return {
    applied: true,
    codes: ["applied"],
    reasons: [],
    quote,
    event,
    contract: nextContract
  };
}
function closeMeteredEscrowContract(contract, status = "completed", closedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  return withEscrow({
    ...contract,
    status,
    updated_at: closedAt
  });
}
function verifyMeteredEscrowContract(contract) {
  const codes = [];
  if (contract.schema !== METERED_ESCROW_SCHEMA) codes.push("unsupported_schema");
  if (!contract.contract_id) codes.push("missing_contract_id");
  if (!contract.terms_hash) codes.push("missing_terms_hash");
  if (!contract.body_hash) codes.push("missing_body_hash");
  if (!contract.token_service_card_id || !contract.token_service_card_hash) codes.push("missing_token_service_card_ref");
  const expected_terms_hash = sha2565(contractTermsBody(contract));
  const expected_contract_id = `mec_${expected_terms_hash.slice("sha256:".length, "sha256:".length + 32)}`;
  const expected_body_hash = sha2565(contractBody({ ...contract, terms_hash: expected_terms_hash, contract_id: expected_contract_id }));
  if (contract.terms_hash && contract.terms_hash !== expected_terms_hash) codes.push("terms_hash_mismatch");
  if (contract.contract_id && contract.contract_id !== expected_contract_id) codes.push("contract_id_mismatch");
  if (contract.body_hash && contract.body_hash !== expected_body_hash) codes.push("body_hash_mismatch");
  const statuses = [
    "accepted",
    "funded",
    "active",
    "exhausted",
    "completed",
    "refunded",
    "disputed",
    "resolved",
    "expired"
  ];
  if (!statuses.includes(contract.status)) codes.push("invalid_status");
  if (contract.pricing.currency !== "sats" || !Number.isFinite(contract.pricing.input_sats) || !Number.isFinite(contract.pricing.output_sats) || contract.pricing.input_sats < 0 || contract.pricing.output_sats < 0 || contract.pricing.input_sats + contract.pricing.output_sats <= 0 || !positiveInteger(contract.pricing.max_contract_sats)) {
    codes.push("invalid_price");
  }
  if (!positiveInteger(contract.escrow.escrowed_sats) || contract.escrow.escrowed_sats > contract.pricing.max_contract_sats || !nonNegativeInteger(contract.escrow.spent_sats) || !nonNegativeInteger(contract.escrow.refundable_sats) || !nonNegativeInteger(contract.escrow.settled_sats) || !nonNegativeInteger(contract.escrow.disputed_sats)) {
    codes.push("invalid_escrow_amount");
  }
  const seenRequestIds = /* @__PURE__ */ new Set();
  let usageSum = 0;
  for (const event of contract.usage_events) {
    if (event.schema !== USAGE_EVENT_SCHEMA || !event.event_id || !event.request_id || event.contract_id !== contract.contract_id || !event.model_id || !nonNegativeInteger(event.input_tokens) || !nonNegativeInteger(event.output_tokens) || event.cached_input_tokens !== void 0 && !nonNegativeInteger(event.cached_input_tokens) || event.input_tokens + event.output_tokens + (event.cached_input_tokens ?? 0) <= 0 || !positiveInteger(event.sats_charged)) {
      codes.push("invalid_usage_event");
    }
    if (seenRequestIds.has(event.request_id)) codes.push("duplicate_request_id");
    seenRequestIds.add(event.request_id);
    usageSum += event.sats_charged;
  }
  if (usageSum !== contract.escrow.spent_sats) codes.push("usage_sum_mismatch");
  if (usageSum > contract.escrow.escrowed_sats) codes.push("spend_exceeds_escrow");
  const expectedRefundable = Math.max(
    0,
    contract.escrow.escrowed_sats - contract.escrow.spent_sats - contract.escrow.disputed_sats
  );
  if (contract.escrow.refundable_sats !== expectedRefundable) codes.push("refund_math_mismatch");
  if (contract.limits.expires_at && Number.isNaN(Date.parse(contract.limits.expires_at))) codes.push("invalid_expiry");
  return {
    valid: codes.length === 0,
    codes: codes.length ? Array.from(new Set(codes)) : ["valid"],
    expected_contract_id,
    expected_terms_hash,
    expected_body_hash
  };
}
export {
  L402Agent,
  L402Error,
  applyMeteredUsage,
  closeMeteredEscrowContract,
  createContractReceipt,
  createMeteredEscrowContract,
  createServiceCard,
  createTokenServiceCard,
  createWalletPolicy,
  evaluateWalletPolicy,
  getContractNextAction,
  quoteMeteredUsage,
  verifyContractReceipt,
  verifyMeteredEscrowContract,
  verifyServiceCard,
  verifyTokenServiceCard,
  verifyWalletPolicy
};
//# sourceMappingURL=index.js.map