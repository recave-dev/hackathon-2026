# Aster Systems synthetic company corpus

Every company, person, customer, vendor, message, financial figure, and outcome in this folder is fictional. The story is a historical replay set in 2024–2025. Do not present its internal material as a real Rekord SI record. Public e-Doręczenia material is kept separate; see the source URLs in `external-signal.md` and verify them before a live legal claim.

## Demo story

On 12 May 2025, Aster Systems chooses whether to build an e-Doręczenia connector for CivicFlow, partner with ConnectorCo, or postpone. Four named customers asked for an integrated workflow. Sales also reported twelve interested municipalities without a complete list; this is deliberately **weaker evidence**, not a contradictory count of confirmed buyers. The company chooses a paid partner pilot, targets ten paid municipal activations by 12 November, and later records six. A prior digital-signature feature also missed its uptake forecast.

The canonical names, figures, and chronology are in [fact-sheet.md](fact-sheet.md). Source files are organized for the existing Markdown graph importer: one Slack thread or email per file; each meeting note uses headings for decisions, evidence, and actions. CSV rows are additional structured KPI data. The old `knowledge/demo-meeting.md` is an extractor fixture and is **not** part of this corpus; its provisional wording predates these finalized synthetic records.

The server-side TypeScript loader at `src/corpus/synthetic.ts` returns `SourceDocument[]` for `KnowledgeGraph.ingestDocument` and typed KPI rows. Pass `{ asOf: '2025-05-12' }` for a pre-decision demo or `{ asOf: '2025-11-19' }` for the outcome replay. It deliberately excludes this README and the fact sheet so future facts do not leak into source retrieval.

The repository includes two shared SQLite snapshots: `demo-v3-2025-05-12.sqlite` for the decision and `demo-v3-2025-11-19.sqlite` for the measured outcome. Run `npm run import:synthetic -- --as-of 2025-05-12` or use `2025-11-19` to create a separate, ignored `local-demo-v3-<date>.sqlite` copy; the command prints its path. The importer indexes every dated source and applies a small, reviewed fixture of source-linked graph records for the central decision; other content remains full-text searchable. It makes no cloud call. The web UI does not yet read these databases. `importSyntheticCorpus(graph, asOf)` in `src/corpus/import-synthetic.ts` is the app-facing entry point.

## Files and use cases

| Folder | Contents | Demo value |
| --- | --- | --- |
| `slack/` | Seven decision threads plus four `#purchase-requests` threads | Sales claim, capacity, option debate, pilot progress, outcome; tooling purchase approvals and rejections |
| `emails/` | Ten individual messages plus six monthly Pipedrive invoices | Four original customer requests, partner offer, security and commercial context; invoice aggregation |
| `meetings/` | Ten meeting notes | Prior decision, preparation, choice, gate, launch, outcome, next decision |
| `notes/` | Prior decision retrospective and option model | Historical learning and transparent assumptions |
| `kpis/` | Dated observations | Forecast-versus-actual proof |
| `tickets/` | 25 helpdesk tickets, June to November 2025 | Repeating wrong-case-attachment problem for the coworker agent to detect |
| `agents/` | Reports written by agent runs | Agent output as a reviewable source, not a hidden fact |
| Root | Company profile, fact sheet, external signal | Stable entities and public-source boundary |

## Prepared questions

1. Should we build the CivicFlow e-Doręczenia connector, partner, or wait?
2. Which demand claims are supported by named customer requests?
3. What must Marta know before the 12 May leadership review?
4. Did the partner pilot achieve its six-month target?
5. Should we replace the partner connector with an internal build after the pilot?
6. How much did Pipedrive cost us in the last six months, and who is responsible for that spend?
7. What are pilot customers repeatedly asking support for, and what should we build?

## Tooling purchases side story

Karol Bąk, Finance Lead, approves or rejects tool purchases in `#purchase-requests`. On 15 May 2025 he approved Pipedrive Advanced for Tomasz Nowak's sales team (five seats, 170 EUR per month, cap 200 EUR) so the named pilot pipeline could be tracked. He rejected Intercom on 10 June and the Pipedrive LeadBooster add-on on 8 July, then approved three more seats on 3 September (eight seats, 272 EUR per month from 1 October, cap 300 EUR). Six invoices from `billing@pipedrive.example` dated 1 June to 1 November total 1,224 EUR. Tomasz owns the subscription and the November cancellation review. All prices and invoice numbers are fictional; see [docs/usecases.md](../../docs/usecases.md) for the retrieval walkthrough.

Use dates to prevent future leakage: a briefing opened on 12 May 2025 must not retrieve November's outcome as if it were already known. Some documents intentionally disagree in confidence and interpretation. Preserve both claims and their provenance.

## Support tickets and the coworker agent

Because Intercom was rejected, pilot municipalities write to the helpdesk mailbox. `tickets/` holds 25 tickets. Nine of them, from Brzozowa, Jasna Dolina, Zielone Wzgórze and Lipowa, describe incoming e-Doręczenia messages attached to the wrong CivicFlow case because the partner connector matches on sender rather than case reference. `npm run agent:support -- --as-of 2025-11-17` replays the support pattern watcher, which files a report in `agents/` and a pending graph proposal for the 19 November decision. See [docs/usecases.md](../../docs/usecases.md), use case 4.
