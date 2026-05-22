# Satonomous Feedback Inbox

Use this file as the lightweight human-and-agent intake layer for satonomous.

The goal is simple:
Capture real signals that should influence product, onboarding, and social positioning.

## How To Use
Add short bullets, not essays.
Include dates, links, or source context when available.
Prefer concrete friction over vague opinions.

## Objections Heard
- Template:
  - [YYYY-MM-DD] Source: <person/channel/link> | Objection: <what they pushed back on> | Notes: <why it matters>

## Feature Requests
- Template:
  - [YYYY-MM-DD] Source: <person/channel/link> | Request: <feature request> | Urgency: low/med/high | Notes: <use case>
- [2026-05-21] Source: social ops product-growth run | Request: `ContractReceipt v0` docs artifact first, then SDK + MCP helpers | Urgency: high | Notes: lifecycle, ledger, and reputation exist, but there is still no portable receipt object for completed work that social posts, directories, demos, or other agents can inspect.

## Onboarding Friction
- Template:
  - [YYYY-MM-DD] Source: <person/channel/link> | Friction: <where they got stuck> | Step: <signup/demo/install/funding/etc> | Notes: <details>
- [2026-05-15] Source: cron intake / GitHub + npm + README check | Friction: public MCP docs have naming drift between `satonomous-mcp` and legacy `l402-mcp`; GitHub README still shows legacy install/command text while npm package is `satonomous-mcp@0.2.2` | Step: install/config | Notes: first-time builders may doubt which package, command, or repo is canonical.
- [2026-05-15] Source: satonomous implementation scout / npm + live docs check | Friction: `satonomous-mcp` README now tells users to run `satonomous-mcp`, but the published package only exposes the `l402-mcp` binary; README also links `/openapi.json`, which returns 404 | Step: install/first-run/docs | Notes: this is a direct first-run trust failure for agent builders and should be fixed before more distribution.
- [2026-05-18] Source: 1 PM social ops live check | Friction: public docs still advertise `https://l402gw.nosaltres2.info/openapi.json` but it returns 404; npm `satonomous-mcp@0.2.2` still exposes only `l402-mcp` and points repository metadata at legacy `jordiagi/l402-mcp` | Step: install/config/docs | Notes: treat this as a growth blocker before driving builders from social posts to the MCP package.
- [2026-05-18] Source: 5 PM social ops live npm/docs check | Friction: `satonomous-mcp@0.2.3` fixed the binary alias and npm repository metadata, but the published README still advertises `https://l402gw.nosaltres2.info/openapi.json`, which returns 404 | Step: install/docs | Notes: doc-only republish should happen before the next builder-facing MCP post.

## Bugs Spotted Informally
- Template:
  - [YYYY-MM-DD] Source: <person/channel/link> | Bug: <what broke> | Surface: <repo/app/demo/docs> | Notes: <details>

## Messaging Wins
- Template:
  - [YYYY-MM-DD] Source: <person/channel/link> | Message: <line/angle that landed> | Notes: <why it resonated>
- [2026-05-19] Source: 1 PM social ops refinement | Message: "Access payment is a transaction. Paid work is an agreement with state." | Notes: Strong reply spine for x402/MCP/wallet/checkout conversations; keeps Satonomous complementary to payment rails while owning contract state.
- [2026-05-20] Source: 5 PM social ops live gate check | Message: "The builder CTA is open again: npm package + OpenAPI docs are coherent enough to send people to the MCP path." | Notes: `satonomous-mcp@0.2.4` is published, exposes both `satonomous-mcp` and `l402-mcp`, points at the canonical repo, and `https://l402gw.nosaltres2.info/openapi.json` now returns `200`.
- [2026-05-22] Source: 9 AM social ops market-comps run | Message: "Paid access gets a payment receipt. Retail checkout gets an order receipt. Paid agent work needs a contract receipt." | Notes: Maps Satonomous to a concrete missing object across Cloudflare paid MCP/x402, Stripe ACP checkout, and Coinbase AgentKit wallet positioning.

## Messaging Misses
- Template:
  - [YYYY-MM-DD] Source: <person/channel/link> | Message: <line/angle that confused people> | Notes: <why it missed>

## Competitor / Market Signals
- Template:
  - [YYYY-MM-DD] Source: <company/link> | Signal: <what they shipped/said> | Why it matters: <implication for satonomous>
- [2026-05-15] Source: Stripe ACP / Cloudflare x402+MPP / Agent Payments Stack | Signal: agent payments are being framed around checkout, HTTP 402, and payment rails | Why it matters: Satonomous should position as the escrow/work-contract layer rather than another generic agent payment rail.
- [2026-05-16] Source: x402.org / Coinbase x402 docs / Cloudflare Agents x402 docs / Stripe agentic commerce / Cryptorefills / AgentLux / Merxex | Signal: market examples split into access-payment rails, agentic checkout/catalog flows, and work-trust surfaces like escrow, reputation, receipts, and disputes | Why it matters: Satonomous should claim the Lightning-native work-contract layer: x402 pays for access; Satonomous escrows work.

## Candidate Proof Points
- Template:
  - [YYYY-MM-DD] Source: <demo/metric/link> | Proof: <evidence worth using in content> | Notes: <context>
- [2026-05-15] Source: GitHub + npm intake | Proof: GitHub issues/stars/forks are still empty, while npm shows light package pull-through (`satonomous@0.3.0`, `satonomous-mcp@0.2.2`) | Notes: traction is pre-social-proof; use demos/receipts as proof instead of popularity claims.
- [2026-05-15] Source: live gateway docs check | Proof: `https://l402gw.nosaltres2.info/docs` is live but still frames the product as a generic L402 paywall/snippet service and points API examples at `l402-gateway.yf-ae7.workers.dev` | Notes: public docs do not yet match the current agent escrow narrative.
- [2026-05-16] Source: market comp scan | Proof: multiple market-facing projects already use the language of agent identity, reputation, escrow, delivery, and disputes | Notes: a public Contract Receipt object would convert Satonomous contract completions into shareable proof and early reputation.
- [2026-05-18] Source: npm live package check | Proof: `satonomous-mcp@0.2.3` now exposes both `satonomous-mcp` and `l402-mcp` binaries and points repository metadata at `jordiagi/satonomous-mcp` | Notes: usable social proof after the dead OpenAPI README link is removed or replaced.
- [2026-05-20] Source: npm + live gateway check | Proof: `satonomous-mcp@0.2.4` is live, `satonomous@0.3.1` is live, and the OpenAPI endpoint returns OpenAPI 3.1.0 with 14 paths. | Notes: this removes the main blocker against a builder-facing MCP/quickstart post; avoid claiming traction metrics, but it is now reasonable to point builders at docs and npm again.

## Open Questions
- What are builders most excited about right now?
- Where does trust still feel weak?
- Which part of the product sounds coolest but is hardest to understand?
- What would make someone try satonomous this week instead of just saying "interesting"?

## Intake Summary Rules
When an agent reads this file, it should:
1. cluster recurring themes
2. separate noise from real friction
3. suggest one product improvement
4. suggest one onboarding improvement
5. suggest one messaging improvement
6. ask for approval only when there is a concrete next move
