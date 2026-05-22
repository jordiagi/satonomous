# Satonomous — Signals Seen In The Wild

Rolling log of competitive/framing signals observed during campaign runs.
One line per signal: date | source | finding | implication.
Goal: stop re-researching the same comps every morning. Feed into the
weekly roll-up and positioning refinements.

Format:
- [YYYY-MM-DD] source | finding | implication

## Log

- [2026-04-18] Google press / AP2 docs | AP2 extends A2A with a
  payments layer, card-rail + partners | Tailwind for "agents need
  payment protocols" narrative; don't punch at Google; write the
  complementary "AP2 is great and you still need Lightning for small
  jobs" post before someone else does.
- [2026-04-18] arxiv 2505.12490 | A2A multi-agent flows leak
  credentials / have privilege-escalation risks | Strengthens case for
  scoped permissions + spending controls (brief Tier 2 #8); flag for
  future positioning, not immediate.
- [2026-04-18] npm `agent-escrow` + MCP scorecard batch | Nostr +
  Lightning escrow OSS primitive exists; ~25 new MCP payment servers
  in one batch | Field is fragmented; our edge is integration quality
  (one SDK, one MCP surface, one reputation graph), not another
  primitive.
- [2026-04-19] blog.quicknode.com ERC-8183 writeup +
  agenticcommercemap.com | ERC-8004 + ERC-8183 + x402 being framed as
  a "complete stack" (discovery + job + payment) | This is the real
  competitive narrative, not any single standard. We need a one-breath
  counter-frame: "one Lightning-native stack vs. three EVM standards
  stitched together." Draft filed in today's run.
- [2026-04-19] cloudflare.com press 2026-04-13 | Cloudflare Agent Cloud
  expanded for production agent workloads (hosting/runtime, not
  payments) | No direct overlap. Watchlist only: if Cloudflare ships
  anything payment-adjacent, they'll default to x402. Distribution
  path through Cloudflare-hosted agents runs through x402 unless we
  show up early. Revisit after we ship escrow.
- [2026-04-20] gh read of jordiagi/satonomous + satonomous-mcp |
  Public API surface is branded `L402` throughout (classes, env var,
  header, URL, 16 MCP tools). Brand mismatch vs. campaign
  "Satonomous" narrative. Zero issues/stars/forks on either repo;
  last push Apr 3–4; no users, no signal. Milestone escrow +
  portable reputation are NOT in code yet (single-release escrow +
  dispute-open are). | Biggest finding of the campaign so far:
  the comparison one-pager + headline posts are writing checks the
  code hasn't cashed. Rename SDK surface and revise headline to
  "post-offers-and-hire" language before publishing anything.
- [2026-04-20] gh search "l402 gateway" | payl402/l402-gateway is
  a separate public L402 project (RGB + Taproot Assets, 2025-11).
  Name collision risk real. | Second reason to shift public surface
  from `l402-*` to `satonomous-*`. Builders searching l402 find the
  wrong project.
- [2026-04-21] lightning.engineering + coinslegend + btcboard |
  Lightning Labs open-sourced L402 Agent Tools on 2026-02-11: 7
  composable skills, `lnget` CLI, remote-signing, scoped creds, MCP
  server for node state. Lightning-native agent tooling straight
  from Lightning Labs. | Closest competitor we have. Their shape is
  primitives + CLI; ours is one-import SDK with offers/escrow/
  disputes/ledger on top. Reposition as "contracts layer on top of
  Lightning agent primitives" — theirs or anyone's. Third reason to
  rename public surface off `l402-*`.
- [2026-04-21] github.com/nervosnetwork/fiber/issues/1255 | Fiber
  (CKB Lightning) RFC surveys x402 / Stripe ACP / L402 / Fiber
  native as the four rails for AI agent payments across three
  scenarios (M2M micropayments, A2A service trading, agent proxy
  shopping); recommends dual-track. | Tailwind: L402 is now one of
  the four canonical rails at protocol-RFC level; we stop having to
  justify Lightning from scratch. Vocab upgrade: "A2A service
  trading" is more precise than "agent marketplace." Draft a
  "four rails, four scenarios" post for post-dev-mode queue.
- [2026-04-21] colosseum.com AION SDK + clawshake.com | Two direct
  shape-twins of satonomous: AION = TypeScript SDK on Solana with
  wallet+escrow+payments+reputation (21 instructions, Anchor,
  devnet, npm); Clawshake = TypeScript SDK on Base with USDC
  escrow, ReputationEngine, FeeOptimizer, AgentOrchestrator (7
  contracts, 141 tests). | "One SDK for agent commerce" is no
  longer a unique shape claim. Differentiation compresses to
  rails: final settlement in seconds, sub-cent fee floor, no gas
  token, no bridge. New positioning candidate ("AION does it on
  Solana, Clawshake does it on Base, Satonomous does it on
  Lightning — here's what rails change") is the first honest
  comparison pitch we've had.
- [2026-04-25] kustodia.app/ai-agents | Kustodia — fifth shape-twin.
  Positions itself as "the trust layer for autonomous commerce."
  36 MCP tools, x402 pay-per-call, AP2 adapter, escrow on
  Arbitrum + Base + Polygon, gasless via ZeroDev, A2A trading,
  compatible with Claude / OpenAI / CDP / Alchemy / Google ADK.
  | Three-rail EVM player explicitly claiming "trust layer" — same
  positional language we're using. Differentiation tightens further:
  three EVM L2s + ZeroDev gas sponsorship is now table stakes for
  the Ethereum side; our wedge is rails (BTC final settlement,
  no gas token) plus contracts shape (offers/escrow/disputes/
  reputation in one SDK). "Trust layer" headline is now contested
  vocabulary — consider "settlement and contracts layer" as a
  sharper alternative when the rename PR ships. Add Kustodia to
  the rails sheet's "who picks what" table as a third EVM bullet
  alongside x402/Base. Not adding to outreach cohort: shape is far
  enough (multi-chain, USD-stablecoin-first, gas-sponsored) that
  neither interop nor why-Lightning pitch lands cleanly.
- [2026-04-25] arxiv 2511.03434 | "A Comparative Study of Brief,
  Claim, Proof, Stake, Reputation and Constraint in Agentic Web
  Protocol Design — A2A, AP2, ERC-8004, and Beyond." Six-trust-
  model taxonomy with attack-surface analysis per model.
  | Vocabulary upgrade. "Reputation" as a category is now a named
  axis in academic literature alongside Stake / Proof / Claim /
  Brief / Constraint. When we ship the read endpoint, the post
  should say "Reputation in the Brief/Claim/Proof/Stake/Reputation/
  Constraint taxonomy — we picked the Reputation axis, here's why
  for Lightning-native A2A." That framing places Satonomous inside
  a published taxonomy rather than competing with it. Also useful
  for the AION/Clawshake/RELAY honest-comparison post: those three
  pick Stake (RELAY's RLY), Proof (Clawshake's verifier), and
  Reputation (AION's graph) respectively — making each rail's
  trust-model bet explicit.
- [2026-04-26] agenticcommercemap.com | Public agent-commerce market map maintained by @rickkdev, 207+ companies, contributed via GitHub issues. Categories: UI / Agent Harness / Frameworks / Networks / Stablecoins / Crypto Commerce / Identity & Trust / Wallets / Payment Processors / Payment Infra / Discovery / Models / Blockchains / Hosting / Standards. | Satonomous not listed in any category. Lightning not on Blockchains list (Eth/Arb/Base/Solana/Stellar/etc only). L402 not on Standards & Protocols (x402/ERC-8004/AP2/MPP/UCP/AXTP/etc only). Default builder-discovery surface for the space currently shows the EVM/x402/MPP world and not Lightning at all. Fixable distribution gap — propose submission via GitHub issue, ship-gated on rename PR. Filed as today's outreach idea.
- [2026-04-26] molty.cash (api.molty.cash, x402scan) | Sixth shape-twin. Created 2026-04-20. Tagline: "Send tips, hire for tasks, and create gigs — settled on-chain via x402 (Base, Solana, World Chain) and MPP (Tempo, Stellar, Monad)." Six chains, x402 + MPP rails. ~1,731 tx in ~6 days per x402scan. | "Hire-for-tasks" copy is no longer a unique hook — moved to a six-day-old multi-chain stablecoin product. Differentiation tightens to rails specifically: sub-cent fees, no gas token, BTC settlement, Lightning native. Slot into Brief/Claim/Proof/Stake/Reputation/Constraint frame as Brief+Constraint multi-chain stablecoin like Kustodia. Not adding to outreach cohort (rails too distant for interop pitch).
- [2026-04-26] atxp.ai / hub.atxp.ai (verified via x402scan) | ATXP — "The account for AI agents. Fully compatible with x402 and MPP." One-breath tighter than any pitch we've drafted. Public on-chain numbers: 14,064 tx, 6,370 unique buyers, ~$5,428 volume on Base. Created 2026-04-14 (12 days). | Most-threatening shape-twin to date — first comp with audit-able non-trivial usage. Honest comparison-post line when it publishes: "ATXP shipped first on x402+MPP rails and has X public transactions; Satonomous picks Lightning rails — here's the trade-space." Don't pretend numbers don't exist. Slot probably Brief+Reputation, account-shape not network-shape. Confirms public ecosystem dashboards (x402scan) are now a competitive surface — no Lightning equivalent exists. Promotes brief Tier 3 #13 (public stats dashboard) in cost-of-not-having-it terms.
- [2026-04-26] x402scan.com / list402.com / agoragentic.com (one-line bonus) | x402scan = on-chain explorer of x402 ecosystem (citation default for x402 volume claims). list402 = directory of x402 merchants (1.2M monthly tx claimed, unverified, shopify-shape, not our wedge). agoragentic = another "Agent OS for deployed agents and swarms" (wallets/budgets/x402+USDC/marketplace/MCP/A2A) — adds nothing beyond AION/Clawshake/RELAY/Kustodia/molty pattern, no separate entry warranted. | x402scan worth flagging as the default citation surface when discussing EVM-side ecosystem volume.
- [2026-05-03] linuxfoundation.org/x402foundation +
  cryptonews.com 2026-04 + alchemy.com | x402 Foundation
  officially launched April 2, 2026 under Linux Foundation
  (LF Projects, LLC). Founding coalition: Coinbase, Stripe,
  Cloudflare, AWS, Google, Microsoft, Visa, Mastercard, Circle,
  Shopify. | Largest competitive-landscape shift since campaign
  start. x402 is no longer "an EVM standard" — it is the
  institutional-blessed candidate for HTTP-native machine
  payments. Implication: "compose, don't displace" framing must
  be strengthened, not softened. Don't fight x402; position
  Lightning as the rail x402 settlements happen on when
  sub-cent fees + final settlement matter. The standards-venue
  lane (PR #1932) just gained legitimacy — LF-stewarded protocol
  is a different tier than Coinbase-internal repo. The "x402 vs
  Lightning" framing is now structurally a losing posture; the
  "contracts/escrow/reputation layer above x402" framing is the
  only remaining story. Feeds directly into next (1) positioning
  slot.
- [2026-05-03] coinalertnews.com 2026-02-10 | x402 on-chain
  transaction volume dropped >92% from December 2025 to February
  2026. "Significant gap between developer tools and real on-
  chain demand." | Counter-data point to the LF Foundation news.
  Two facts together (April 2 LF launch + 92% Feb volume drop)
  are the strongest single piece of evidence the campaign has
  surfaced for its wedge: the rails are getting standardized;
  the trade isn't happening yet; the missing piece isn't a
  payment protocol, it's contracts, escrow, reputation. SOURCE-
  CHECK REQUIRED before this number goes near any draft —
  verify against x402scan directly. If it holds, it's load-
  bearing for a refreshed Draft #5A (third citation),
  standards-venue Layer-B comment, and any honest-comparison
  post.
- [2026-05-03] cache256.com / forbes.com 2026-02-05 | HeyElsa
  named as canonical "full agent commerce stack" example
  (x402 + ERC-8004 integrated for intent workflows like
  portfolio rebalancing). Claimed numbers: 18.9M prompts, $503M
  tx volume — two orders of magnitude above ATXP's ~$5.4K. ERC-
  8004 confirmed live on Ethereum mainnet (Forbes 2026-02-05).
  | Numbers UNVERIFIED — round figures suspicious; do not cite
  in any post until checked directly. What is confirmed: HeyElsa
  is being held up by ecosystem writers as the default "full
  stack" example, which moves it from "watchlist" to "named comp"
  conditional on numbers verifying. Bigger signal: "x402 +
  ERC-8004" is now the public default story for agentic commerce
  — our wedge needs to be visibly *above* both, not parallel to
  either.
- [2026-05-03] agentsboard.io / abbababa.com / agentlancer.io /
  swarmsync.ai (passthrough) | Four more shape-twins surfaced.
  All USDC/USDT, escrow + reputation, marketplace-shape. Abba
  Baba uses "A2A settlement layer" — direct vocabulary collision
  with our framing. SwarmSync is first AP2-protocol-native shape-
  twin we've seen. | Signal is not any individual entry; signal
  is that the "agent-to-agent escrow + reputation + USDC market-
  place" category is now saturated. "Trust layer" (Kustodia),
  "settlement layer" (Abba Baba), "complete stack" (The Graph +
  ERC-8004 + x402) are all contested vocabulary. What Satonomous
  still owns positionally: Lightning rails, contracts shape
  (offers/escrow/disputes/reputation in one SDK), and the
  "preimage not signature" technical claim. "Contracts and
  settlement layer" is one of the few phrases not yet directly
  contested — hold the line on it.
- [2026-05-04] github.com/x402-foundation/x402 issues #2176 + PR #2175 (Hilal Agil, 2026-05-02) | Active proposal for `mandate-bound` x402 scheme: binds payment authorization to a constraint envelope (purpose, recipient, time window, sub-cap) rather than a single transfer. EVM impl drafted. ~80 hours old, active discussion. | This is contracts-shape inside x402's own protocol surface — the half of the agentic-payment problem x402 doesn't currently solve, named explicitly inside the protocol's own venue. Lightning has structurally cleaner answers for time-window (HTLC cltv enforces at rail level), operation-binding (preimage commits to operation hash natively), and sub-cap composition (preimage subtrees). No Lightning-side voice in the thread. **This is the right Layer-B target for the standards-venue lane, not the dormant PR #1932.** PR #1932 (operation-binding companion, 5/1 named target) has had zero activity since April 4, ~30 days dormant — drop from candidate set.
- [2026-05-04] github.com/x402-foundation/x402 issues #2112 + #2156 | Five independent teams reproducing 'CDP facilitator settles cleanly, Bazaar discovery never indexes' across three runtimes (Cloudflare Workers, Render, Azure Container Apps) and three chain stacks (Base/USDC, Solana/USDT, Eth/USDT). Community has self-organized into A2A `agent-card.json` + AP2 `ap2.json` + x402scan triangle as a non-CDP discovery hedge. Three reference implementations live (chain-analyzer.com, hivemorph.onrender.com, api.rtkmotion.io). Maintainers silent for 11 days. One contributor commented thread is 'a bunch of chatgpt bots talking to each other' (2026-05-01). | **Public, time-stamped, instrumented evidence that 'rails are standardized but the trade isn't happening yet' is true at operator level, not just at narrative level.** Better than the 92% volume drop as a load-bearing citation: reproducible, public, self-investigated by the community itself. Cite in Draft #5A revision: 'Five teams settling cleanly through the CDP facilitator over the past two weeks; zero appear in Bazaar discovery; they have built their own discovery triangle. Issue #2112 / #2156, public.' Stronger close than the volume number.
- [2026-05-04] github.com/x402-foundation/x402 issue #2067 (@aeoess comment, 2026-05-04 06:36 UTC) | New voice in delegated-payment-policy thread raises 'rotation under compromise' as the key failure mode for address-keyed cap accounting: a legitimate rotation and a stolen-key signature collapse to the same case. Proposes DID-keyed policy state with a `retiredAt` walk; tested across x402, ACP, AP2, MPP. Asks @ajm6238 directly where passport+delegation infra becomes lower-cost than per-condition attestation. | This is exactly the question Satonomous's portable-reputation receipts spec answers, in different vocabulary. Receipts are key-pinned; retiring a key invalidates the receipt set in a verifier-auditable way. Issue is explicitly soliciting third-party input — third voice with adjacent expertise reads as helpful, not opportunistic. Secondary Layer-B target after #2176, sequenced not parallel.
- [2026-04-23] relaynetwork.ai | RELAY — third Solana-based shape
  with live (devnet beta) reputation graph + contract market +
  agent mesh; Ed25519 agent identity; RLY token; DAO + ZK
  verifiable compute + Proof-of-Intelligence consensus on 2026
  roadmap. Network-shape, not SDK-shape. Stats on landing (their
  numbers): 47 agents, 15 contracts, 2,341 services, ~84K RLY
  lifetime escrow released. | Third shape-twin shipping
  reputation as a named live feature — strengthens the Wed AM
  "reputation next after dev-mode" call. Rails vocab fix: Solana
  is not one bucket (AION = SDK-first, RELAY = network-first).
  Discovery-as-distribution evidence keeps piling up. Distinct
  bet from ours on token-incentivized reputation — worth naming
  in replies when asked. Not adding to outreach cohort: token +
  DAO shape is far enough that neither interop nor why-Lightning
  pitch lands cleanly.
- [2026-05-10] x402.org | x402's public story is now very crisp: HTTP 402 flow, one-line middleware, agent pays and retries, zero protocol fees/friction, stablecoin-based settlement. | Treat x402 as tailwind, not enemy. Satonomous should own the contract surface around payment: offer, escrow, delivery, dispute, receipt, reputation.
- [2026-05-10] skyfire.xyz | Skyfire frames itself as "The Agentic Commerce Platform" with payments + Know Your Agent identity for autonomous service access. | Broad platform + identity lane is occupied. Avoid generic "trust layer" unless reputation/identity is live; use narrower "Lightning-native contract infrastructure" lane.
- [2026-05-10] Coinbase AgentKit docs | AgentKit positions as secure wallet management + onchain actions for agents, multi-network and framework-flexible. GitHub tagline: "Every AI Agent deserves a wallet." | Do not fight the wallet/toolkit frame. Satonomous contrast: every paid agent job needs more than a wallet — it needs offer/escrow/release/dispute/receipt/reputation.
- [2026-05-11] nevermined.ai | Nevermined frames agent commerce as “Let your agents pay and get paid. Autonomously,” with virtual cards, spending rules, real-time metering, PSP-agnostic rails, and an Open Agent Network. | Autonomy + delegated spend is crowded. Satonomous should position at the job-contract envelope: offer terms, escrow state, delivery proof, release/dispute, receipt.
- [2026-05-11] paymanai.com | Payman AI headline: “Agentic AI That Does the Banking. Under Your Control.” Concrete examples: bill pay, transfers, spend analysis on existing bank rails. | “Under your control” is becoming the buyer-safe agent-money phrase. Satonomous translation: contract-bound Lightning wallets; agents spend only inside an agreed job envelope.
- [2026-05-11] Coinbase x402 docs | x402 positions as HTTP-native 402 Payment Required flow for programmatic API/content payments by humans and AI agents. | x402 owns pay-per-request protocol clarity. Satonomous should own paid-work lifecycle above/beside payment: offer → escrow → delivery → release/dispute → receipt → reputation.
- [2026-05-12] agenticcommercemap.com/category/discovery | Discovery is now explicitly framed as the problem of building a “Google for agents”: searchable, trustworthy, machine-readable product/service catalogs. x402jobs, 402.bot, WURK, 8004scan, and Valoria are listed as discovery surfaces. | Satonomous needs an indexable contract/listing object, not only a wallet/SDK story. Add a `satonomous.json` or contract-profile spec: capabilities, price/terms, escrow policy, delivery-proof requirement, receipt/reputation URL, Lightning rail.
- [2026-05-12] agenticcommercemap.com/category/payment-infrastructure | Gwop, Conto, and Unicity Labs show the category language moving from raw payments to permissions, policy, dispute arbitration, control centers, private negotiation, atomic settlement, and agentic marketplaces. | Keep avoiding generic “agent payments.” The differentiated Satonomous lane is paid-work lifecycle infrastructure: offer → escrow → delivery proof → release/dispute → receipt, settled over Lightning.
- [2026-05-12] agenticcommercemap.com/category/identity-and-trust | Identity & Trust is a full category: ERC-8004, Cascade, AgentProof, KYA vendors, DID/VC identity, and reputation leaderboards. AgentProof claims 68k+ agents scored across 21 networks. | Reputation has moved from roadmap nice-to-have to category expectation. MVP should be public contract receipts / receipt profile before a full graph: completed contracts, outcomes, disputes, timestamps, proof hashes.
- [2026-05-14] x402scan.com / agenticcommercemap.com / list402.com | Public discovery and proof surfaces are becoming category infrastructure: x402 has an explorer; Agentic Commerce Market Map has 207+ companies and a GitHub submission flow; ListX402 claims merchant counts, monthly tx, receipts/webhooks, and buyer protection. | Satonomous needs inspectable activity, not just SDK claims. Sequence: receipt JSON first, then tiny receipts/activity dashboard, then market-map submission. Position as Lightning-native contract activity: offer → escrow → delivery proof → release/dispute → receipt → aggregate stats.
- [2026-05-17] x402.org + Cloudflare x402 + Stripe agentic commerce docs | x402's public story is now crisp pay-per-request access; Cloudflare is tying x402 to Agents SDK/MCP; Stripe's agentic commerce surface is seller catalogs + checkout + MPP/x402/UCP/ACP. | Refine Satonomous away from generic "agent payments" and toward "payment proof is not work proof." Next product-growth object after public receipts: directory-ready service cards for offers, so agent-service directories can index Satonomous work before a full marketplace exists.
- [2026-05-17] jordiagi/satonomous direct read | The SDK already has an `Offer` type plus `createOffer` / `listOffers` / `getOffer`; satonomous-mcp exposes offer tools, but neither repo has `SERVICE_CARDS.md`, `service-card-example.json`, `satonomous.json`, or a portable offer-card output. | The missing growth feature can be narrower than a marketplace: a docs-first ServiceCard v0 generated from existing offers. Receipts prove past work; service cards make future work hireable and directory-indexable.
- [2026-05-14] jordiagi/satonomous repo (direct read) | `examples/first-contract.ts` already runs offer → fund → delivery → release → ledger inspect. `src/types.ts` defines `Contract` + `LedgerEntry` shapes. Landing live at satonomous.nosaltres2.info (200). | Morning/afternoon ship-gate on "receipt JSON artifact does not exist yet" is wrong. The artifact is harvestable today as `examples/receipt-example.json` + `RECEIPTS.md` distilled from existing types and example output — no protocol change needed. This unblocks both the headline post and the market-map submission without waiting on new product surface.
- [2026-05-17] agenticcommercemap.com + direct category reads | Satonomous is not indexed in the Agentic Commerce Market Map; the site offers a GitHub issue submission flow. Payment Infrastructure already includes protocols, policy layers, agent wallets, dispute arbitration, private negotiation, atomic settlement, and agentic marketplaces. Wallets & Tooling and Identity & Trust are crowded with agent-wallet and reputation/KYA players. | Submit Satonomous first as Payment Infrastructure, not Wallets or Identity & Trust: "Lightning-native contract infrastructure for AI agents that trade paid work." Before submission, add or confirm a real square icon URL; current /favicon.ico returns HTML.
- [2026-05-18] rickkdev/agenticcommercemap GitHub issue | Jordi approved the market-map submission after the square icon URL was fixed. Submitted Satonomous as "Add Company: Satonomous" in Payment Infrastructure with icon URL `https://satonomous.nosaltres2.info/icon.png`. | Track approval/merge outcome at https://github.com/rickkdev/agenticcommercemap/issues/13.
- [2026-05-18] Coinbase AgentKit docs + Skyfire + Nevermined official pages | Wallet/toolkit, payments+KYA identity, and delegated-spend/metering lanes are all visibly occupied. AgentKit leads with secure wallet management and onchain actions; Skyfire leads with agentic commerce + Know Your Agent; Nevermined leads with virtual cards, spending rules, metering, PSP-agnostic rails, MCP/A2A/x402/plain HTTP, and an Open Agent Network. | Satonomous should stop leading with "agents can pay" or "agent wallet" and lead with contract state around sats: offer terms, escrow, delivery proof, release/dispute, ledger receipt. Growth feature: a compact contract-policy receipt that explains why sats were allowed to move.
- [2026-05-18] satonomous-mcp npm + gateway docs | `satonomous-mcp@0.2.3` now exposes both `satonomous-mcp` and `l402-mcp` binaries and points npm metadata at `jordiagi/satonomous-mcp`, but the published README still links `https://l402gw.nosaltres2.info/openapi.json`, which returns 404 while `/docs` returns 200. | Do not send builders from a social post to the MCP package until the dead spec link is removed/replaced or the endpoint is restored. The next social artifact should be "boring first-run MCP setup for agent contracts," not a marketplace promise.
- [2026-05-19] x402.org + Cloudflare Agents x402 + Stripe Agentic Commerce/ACP + Coinbase AgentKit | The market is now clearly split across HTTP access payments, paid MCP/tool calls, delegated checkout/catalog flows, and wallet/onchain-action tooling. x402's public page shows meaningful last-30-day activity, Cloudflare documents paid MCP/tool flows, Stripe frames ACP/MPP around agentic checkout and delegated payment, and AgentKit leads with secure wallet management. | Satonomous should use "Paid tools prove access. Paid work needs a contract." as the next positioning spine. Missing growth feature after the doc-only README fix: `satonomous-mcp doctor` to make first-run trust inspectable before asking builders to try the contract lifecycle.
- [2026-05-22] Cloudflare Agents agentic-payments docs + Stripe ACP docs + Coinbase AgentKit product page | Official docs now make the category split very clear: Cloudflare is packaging paid access/paid MCP tools through HTTP 402, Stripe ACP is packaging delegated checkout/order lifecycle, and AgentKit is packaging agent wallets/onchain actions. | Satonomous should frame ContractReceipt v0 as the missing paid-work receipt: paid access gets a payment receipt, retail checkout gets an order receipt, paid agent work needs a contract receipt.
