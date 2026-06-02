import { sha256Canonical } from './canonical-json.js';
import type {
  CreateServiceCardOptions,
  Offer,
  ServiceCard,
  ServiceCardSellerReputation,
  ServiceCardVerificationCode,
  ServiceCardVerificationResult,
  TenantReputation,
} from './types.js';

const SERVICE_CARD_SCHEMA = 'satonomous.service-card/v0' as const;

function serviceCardBody(card: ServiceCard): Omit<ServiceCard, 'card_id' | 'body_hash'> {
  const { card_id: _cardId, body_hash: _bodyHash, ...body } = card;
  return body;
}

function completeServiceCard(card: ServiceCard): ServiceCard {
  const body_hash = sha256Canonical(serviceCardBody(card));
  return {
    ...card,
    body_hash,
    card_id: `sc_${body_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`,
  };
}

function offerTerms(offer: Offer): Record<string, any> {
  return offer.terms && typeof offer.terms === 'object' ? offer.terms : {};
}

function normalizeReputation(
  offer: Offer,
  reputation?: TenantReputation | null
): ServiceCardSellerReputation | null {
  if (reputation?.seller) {
    return {
      score: reputation.seller.score,
      level: reputation.seller.level,
      settled_contracts: reputation.seller.summary.settled_contracts,
      dispute_rate: reputation.seller.summary.dispute_rate,
      total_volume_sats: reputation.seller.summary.total_volume_sats,
      unique_counterparties: reputation.seller.summary.unique_counterparties,
    };
  }

  if (offer.seller_reputation) {
    return {
      score: offer.seller_reputation.score,
      level: offer.seller_reputation.level,
      settled_contracts: offer.seller_reputation.settled_contracts,
      dispute_rate: offer.seller_reputation.dispute_rate,
      total_volume_sats: offer.seller_reputation.total_volume_sats,
      unique_counterparties: offer.seller_reputation.unique_counterparties,
    };
  }

  return null;
}

function defaultProofRequirements(terms: Record<string, any>, options: CreateServiceCardOptions): string[] {
  if (options.proofRequirements) return options.proofRequirements;
  if (Array.isArray(terms.proof_requirements)) {
    return terms.proof_requirements.map(String).filter(Boolean);
  }
  if (typeof terms.proof_requirement === 'string') return [terms.proof_requirement];
  return ['delivery_proof_url_or_payload_hash'];
}

export function createServiceCard(
  offer: Offer,
  reputation?: TenantReputation | null,
  options: CreateServiceCardOptions = {}
): ServiceCard {
  const terms = offerTerms(offer);

  return completeServiceCard({
    schema: SERVICE_CARD_SCHEMA,
    card_id: '',
    body_hash: '',
    issued_at: options.issuedAt ?? new Date().toISOString(),
    seller: {
      agent_id: offer.seller_tenant_id,
      reputation: normalizeReputation(offer, reputation),
    },
    service: {
      offer_id: offer.id,
      service_type: offer.service_type,
      title: offer.title,
      description: offer.description,
      price_sats: offer.price_sats,
      currency: 'sats',
      active: Boolean(offer.active),
      created_at: offer.created_at,
      expires_at: offer.expires_at,
    },
    terms: {
      sla_minutes: typeof terms.sla_minutes === 'number' ? terms.sla_minutes : null,
      dispute_window_minutes:
        typeof terms.dispute_window_minutes === 'number' ? terms.dispute_window_minutes : null,
      max_concurrent_contracts: offer.max_concurrent_contracts,
      escrow_policy: 'lightning_escrow',
      settlement_policy: 'release_dispute_refund',
      proof_required: typeof terms.proof_required === 'boolean' ? terms.proof_required : true,
      proof_requirements: defaultProofRequirements(terms, options),
      ...terms,
    },
    accept: {
      accept_url: options.acceptUrl ?? `satonomous://offers/${encodeURIComponent(offer.id)}/accept`,
      contract_template_ref: options.contractTemplateRef ?? `satonomous:offer:${offer.id}`,
    },
    links: options.links,
  });
}

export function verifyServiceCard(card: ServiceCard): ServiceCardVerificationResult {
  const codes: ServiceCardVerificationCode[] = [];
  const warnings: ServiceCardVerificationCode[] = [];

  if (card.schema !== SERVICE_CARD_SCHEMA) codes.push('unsupported_schema');
  if (!card.card_id) codes.push('missing_card_id');
  if (!card.body_hash) codes.push('missing_body_hash');
  if (!card.service?.active) codes.push('inactive_offer');
  if (!card.accept?.accept_url) codes.push('missing_accept_url');
  if (!card.service?.price_sats || card.service.price_sats <= 0) codes.push('missing_price');

  const expected_body_hash = sha256Canonical(serviceCardBody(card));
  const expected_card_id = `sc_${expected_body_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`;

  if (card.body_hash && card.body_hash !== expected_body_hash) codes.push('body_hash_mismatch');
  if (card.card_id && card.card_id !== expected_card_id) codes.push('card_id_mismatch');

  if (!card.terms?.sla_minutes) warnings.push('missing_sla');
  const rep = card.seller?.reputation;
  if (rep && (rep.score < 0 || rep.score > 100 || !rep.level)) warnings.push('invalid_reputation');

  return {
    valid: codes.length === 0,
    codes: codes.length ? codes : ['valid'],
    warnings,
    expected_card_id,
    expected_body_hash,
  };
}
