# Aster Systems synthetic company corpus

Every company, person, customer, vendor, message, financial figure, and outcome in this folder is fictional. The story is a historical replay set in 2024–2025. Do not present its internal material as a real Rekord SI record. Public e-Doręczenia material is kept separate; see the source URLs in `external-signal.md` and verify them before a live legal claim.

## Demo story

On 12 May 2025, Aster Systems chooses whether to build an e-Doręczenia connector for CivicFlow, partner with ConnectorCo, or postpone. Four named customers asked for an integrated workflow. Sales also reported twelve interested municipalities without a complete list; this is deliberately **weaker evidence**, not a contradictory count of confirmed buyers. The company chooses a paid partner pilot, targets ten paid municipal activations by 12 November, and later records six. A prior digital-signature feature also missed its uptake forecast.

The canonical names, figures, and chronology are in [fact-sheet.md](fact-sheet.md). Source files are organized for the existing Markdown graph importer: one Slack thread or email per file; each meeting note uses headings for decisions, evidence, and actions. CSV rows are additional structured KPI data. The old `knowledge/demo-meeting.md` is an extractor fixture and is **not** part of this corpus; its provisional wording predates these finalized synthetic records.

The server-side TypeScript loader at `src/corpus/synthetic.ts` returns `SourceDocument[]` for `KnowledgeGraph.ingestDocument` and typed KPI rows. Pass `{ asOf: '2025-05-12' }` for a pre-decision demo or `{ asOf: '2025-11-19' }` for the outcome replay. It deliberately excludes this README and the fact sheet so future facts do not leak into source retrieval.

The repository includes two shared SQLite snapshots: `demo-v2-2025-05-12.sqlite` for the decision and `demo-v2-2025-11-19.sqlite` for the measured outcome. Run `npm run import:synthetic -- --as-of 2025-05-12` or use `2025-11-19` to create a separate, ignored `local-demo-v2-<date>.sqlite` copy; the command prints its path. The importer indexes every dated source and applies a small, reviewed fixture of source-linked graph records for the central decision; other content remains full-text searchable. It makes no cloud call. The web UI does not yet read these databases. `importSyntheticCorpus(graph, asOf)` in `src/corpus/import-synthetic.ts` is the app-facing entry point.

## Files and use cases

| Folder | Contents | Demo value |
| --- | --- | --- |
| `slack/` | Seven dated threads, 42 messages | Sales claim, capacity, option debate, pilot progress, outcome |
| `emails/` | Ten individual messages | Four original customer requests, partner offer, security and commercial context |
| `meetings/` | Ten meeting notes | Prior decision, preparation, choice, gate, launch, outcome, next decision |
| `notes/` | Prior decision retrospective and option model | Historical learning and transparent assumptions |
| `kpis/` | Dated observations | Forecast-versus-actual proof |
| Root | Company profile, fact sheet, external signal | Stable entities and public-source boundary |

## Prepared questions

1. Should we build the CivicFlow e-Doręczenia connector, partner, or wait?
2. Which demand claims are supported by named customer requests?
3. What must Marta know before the 12 May leadership review?
4. Did the partner pilot achieve its six-month target?
5. Should we replace the partner connector with an internal build after the pilot?

Use dates to prevent future leakage: a briefing opened on 12 May 2025 must not retrieve November's outcome as if it were already known. Some documents intentionally disagree in confidence and interpretation. Preserve both claims and their provenance.
