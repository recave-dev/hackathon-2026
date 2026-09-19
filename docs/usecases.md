# Demo use cases and the data behind them

Every use case runs against the shared SQLite snapshots in `knowledge/synthetic/` (`demo-v3-2025-05-12.sqlite` and `demo-v3-2025-11-19.sqlite`). Each snapshot contains only sources dated on or before its as-of date, so the same question gives different answers at different points in the fictional timeline. **Everything below is synthetic: Aster Systems, its people, customers, vendors, prices and invoices are fictional.** Rebuild a snapshot with `npm run import:synthetic -- --as-of <date>`.

| # | Question for the demo | Best snapshot | Answer the graph should give |
| --- | --- | --- | --- |
| 1 | Should we build the CivicFlow e-Doręczenia connector, partner, or wait? | 2025-05-12 | Three options, four named customer requests vs. twelve "interested", 16-week build vs. 6-week partner path, prior forecast miss. Decision approved on the same day. |
| 2 | Did the partner pilot achieve its six-month target? | 2025-11-19 | No: six paid activations against a target of ten, with monthly KPI trail. |
| 3 | How much did Pipedrive cost us in the last six months, and who is responsible for that? | 2025-11-19 | 1,224 EUR across six invoices; Karol Bąk approved, Tomasz Nowak owns the subscription; two related requests were rejected. |
| 4 | What are pilot customers repeatedly asking support for, and what should we build? | 2025-11-19 | A coworker agent found nine wrong-case-attachment tickets from four municipalities and proposed "automatic case matching" as an option for the 19 November decision. Pending CEO review. |

Use case 1 and 2 are described in [synthetic-decision-scenario.md](synthetic-decision-scenario.md). This file documents use cases 3 and 4 in full.

## Use case 3: tooling spend with the decision story behind it

### Why this case

It is the everyday CEO or CFO question: "what does tool X cost us and who signed off on it". Answering it well needs three things a plain chat over documents does badly: aggregation across many small sources (monthly invoices), attribution across time (who approved, who owns, what changed), and the rejected alternatives that never generated an invoice. The graph links all three to the e-Doręczenia pilot story, so the demo can move from the big decision to the spend it caused without changing datasets.

### The story in the data

Karol Bąk, Finance Lead, approves or rejects purchases in the `#purchase-requests` Slack channel.

| Date | Source file | What happens |
| --- | --- | --- |
| 2025-05-14 | `slack/2025-05-14-purchase-pipedrive.md` | Tomasz Nowak requests Pipedrive Advanced, five seats at 34 EUR, 170 EUR per month, to track the named pilot pipeline Marta asked for on 12 May. Karol approves on 15 May with a 200 EUR monthly cap. Tomasz owns the seat list and a cancellation review after the November outcome. |
| 2025-06-01 to 2025-09-01 | `emails/2025-0{6,7,8,9}-01-pipedrive-invoice.md` | Four monthly invoices from billing@pipedrive.example, 170 EUR each, five seats. |
| 2025-06-10 | `slack/2025-06-10-purchase-intercom.md` | Ewa Mazur requests Intercom at 74 EUR per month. Karol rejects until paid activations pass ten. |
| 2025-07-08 | `slack/2025-07-08-purchase-leadbooster.md` | Tomasz requests the Pipedrive LeadBooster add-on at 32.50 EUR per month. Karol rejects until the named pipeline converts. |
| 2025-09-02 | `slack/2025-09-02-purchase-pipedrive-seats.md` | Tomasz and Ewa request three more seats for Customer Success. Karol approves on 3 September: eight seats, 272 EUR per month from 1 October, cap 300 EUR. |
| 2025-10-01, 2025-11-01 | `emails/2025-1{0,1}-01-pipedrive-invoice.md` | Two invoices at 272 EUR, eight seats. |

Six invoices, 1 June to 1 November, total **1,224 EUR**. The canonical numbers are also in the fact sheet's "Tooling purchase chronology" table.

### What the graph stores

Seeded records (origin `seed`, status `reviewed`) come from `src/corpus/import-synthetic.ts`:

- People: Karol Bąk (alias "CFO"), Tomasz Nowak, Ewa Mazur, and the other Aster leads.
- Products: Pipedrive, Intercom.
- Metric: `metric:pipedrive-subscription-spend` in EUR.
- Four decisions, each `assigned_to` Karol Bąk and `about` the product: Pipedrive subscription (approved 15 May), Intercom (rejected 10 June), LeadBooster add-on (rejected 8 July), Pipedrive seat increase (approved 3 September). The two approvals `target` the spend metric. Attributes carry approver, requester, owner, cap and seat count as of the snapshot date.

Extracted records (origin `extracted`, each with an exact source quote) come from the fixture extractor:

- Claims that `inform` each decision: the request, the contract terms, the approval or rejection, and the onboarding problem that justified more seats.
- One action node "Own the Pipedrive seat list and the November cancellation review", `assigned_to` Tomasz Nowak and `about` Pipedrive.
- Six observations, one per invoice, with `value`, `currency`, `observed_at`, `seats` and `invoice` attributes. Each `measures` both the spend metric and the original approval decision.

### How a question is answered

1. `graph.buildDecisionContext(question)` runs full-text search over chunks and label matching over nodes. For the question above the anchors are the spend metric, the Pipedrive product, the ownership action and both approved decisions. Expansion through evidence and two graph hops brings in the rejected decisions, their claims and all six invoice observations, each with its quote and file path.
2. `summarizeSpend(graph, 'metric:pipedrive-subscription-spend', { from, to })` in `src/graph/spend.ts` does the arithmetic: it sums observations inside the window, lists the decisions that target the metric, and returns approvers (from `assigned_to` on decisions) and owners (from `assigned_to` on actions about the same product).

Expected result for the window 2025-05-19 to 2025-11-19:

| Field | Value |
| --- | --- |
| Total | 1,224 EUR |
| Invoices | 6 (170, 170, 170, 170, 272, 272) |
| Approver | Karol Bąk |
| Owner | Tomasz Nowak |
| Approved decisions | 15 May 2025, 3 September 2025 |
| Rejected requests nearby | Intercom (10 June), LeadBooster (8 July) |

`npm run import:synthetic -- --as-of 2025-11-19` prints this summary as `pipedriveLastSixMonths`. Tests live in `tests/synthetic-spend.test.ts`.

### Snapshot behaviour

- **2025-05-12:** no purchase channel data exists yet. No Pipedrive node, no metric, and the question returns nothing about it.
- **2025-08-15:** three invoices, 510 EUR, cap still 200 EUR, seat increase not yet requested.
- **2025-11-19:** the full story above.

### Known limits to say out loud in the demo

- The importer uses a reviewed fixture with hand-picked quotes, not an LLM extraction, so the graph records are deterministic. The LLM extractor path exists but is not used for the synthetic corpus.
- Two-hop expansion also pulls in the e-Doręczenia decision subgraph because Karol and Tomasz appear in both stories. That is a retrieval breadth setting, not missing data.
- The web UI does not read these databases yet; the demo runs through the script or a small Node snippet.
- Invoice amounts live only in the invoice emails and their observation nodes. There is no accounting export, so a discrepancy between Slack caps and invoices would need a new source to detect.

## Use case 4: a coworker agent that turns support tickets into product input

### Why this case

CEOs want product input grounded in what customers actually say, not in what Sales remembers. A "coworker" here is a scheduled automation that runs against the company graph, applies a rule, and files a proposal with evidence. It never writes facts on its own. Its report enters the graph through the same ingestion and review path as a meeting note, so every number it states can be clicked back to a ticket.

### The story in the data

Karol rejected Intercom on 10 June, so pilot municipalities use the helpdesk mailbox. Those tickets are in `knowledge/synthetic/tickets/`, one Markdown file each, 25 tickets from 25 June to 14 November 2025.

| Category | Tickets | Customers | Story |
| --- | ---: | ---: | --- |
| `wrong_case_attachment` | 9 | 4 | The partner connector matches incoming e-Doręczenia messages on the sender, not on the case reference. Messages land in the wrong case, a closed case, or another citizen's case. Clerks re-register by hand, which is the manual work the integration was meant to remove. Two customers spell out the fix they want: read the reference number and let the clerk confirm. |
| `training_request` | 6 | 4 | Normal onboarding noise, plus Gmina Sosnowa asking for a demo after hearing from Brzozowa. |
| `login_access` | 4 | 3 | Ordinary access problems. |
| `delivery_status_delay` | 3 | 1 | Real limitation of the partner connector, but only one customer complains, so the rule ignores it. |
| `export_bug` | 3 | 2 | Two defects fixed by engineering, one open. |

Every ticket has a structured line after its heading: `Customer: … · Category: … · Channel: helpdesk mailbox · Opened: …`. The agent parses that line from the chunk text in the graph, so it works from the graph, not from files.

### The agent

`src/agents/support-pattern-watcher.ts` implements one run:

1. `scanTickets` lists support ticket chunks authored on or before the run date and groups them by category. A category fires when the sliding window of 60 days holds at least 4 tickets from at least 3 customers.
2. `buildReport` writes a deterministic Markdown report with the summary, one quoted sentence per ticket in the window, a proposed option and a suggested next step.
3. The report is ingested as a source of kind `agent_report`. A fixed extractor turns it into a claim that `informs` the open follow-up decision and is `about` the e-Doręczenia integration, plus an option node that the decision `considers`. Both land as **pending** proposals unless the run is told to apply them.

Run it with `npm run agent:support -- --as-of <date> [--db <sqlite>] [--apply]`. Without `--db` it builds an in-memory graph for that date first. The report is also saved to `knowledge/synthetic/agents/`.

### Replay across dates

| Run date | Tickets seen | Pattern window | Result |
| --- | ---: | --- | --- |
| 2025-07-15 | 4 | 1 wrong-case ticket, 1 customer | Quiet. |
| 2025-09-01 | 10 | 3 wrong-case tickets, 2 customers | Quiet, but the cluster is visible as "watching". |
| 2025-11-17 | 24 | 6 wrong-case tickets, 4 customers (9 in total since July) | Fires. Report filed, two proposals pending, two days before the 19 November decision meeting. |

### What the proposal contains

- Claim: "Support tickets show a repeating wrong case attachment problem across 4 customers", with attributes for category, ticket ids, counts, customers and `evidence_status: agent_detected`. Evidence: the summary sentence and six ticket lines quoted in the report.
- Option: "Build automatic case matching for incoming e-Doręczenia messages", attached to the decision "Retain the partner connector, build internally, or pause e-Doręczenia expansion" next to the three options leadership already listed.

### Demo script

1. **Coworkers list.** Show one agent card: Support pattern watcher, weekly, last run 17 November, one proposal waiting. Say what it is: a rule over the graph, not a chatbot.
2. **Replay.** Run it for 1 September and show the quiet result with the cluster at three tickets from two customers. Then run 17 November and show it fire. The point is that it waited for evidence.
3. **Open the proposal.** Nine tickets over four months, four municipalities, one problem. Click two quotes: Brzozowa on 28 August saying this is exactly the manual copying they wanted to avoid, and Zielone Wzgórze on 4 November considering switching automatic attachment off. That is churn risk in the customer's own words.
4. **Accept it.** Apply the proposal. Open the 19 November decision: the new option sits beside "retain partner", "build internally" and "pause", backed by ticket evidence rather than opinion. The meeting note from that day says leadership deferred for lack of a support summary. The agent had it two days earlier.
5. **Close the loop.** The 12 May decision created pilot customers, the customers created tickets, the tickets created a product option. Same graph, same provenance.

### Known limits to say out loud

- Categories come from the helpdesk export, so clustering is exact matching, not language understanding. A real deployment would classify free text first, then apply the same rule.
- The proposal informs the decision but does not rank options or estimate cost. That stays with Product.
- The agent runs on demand in the demo. Scheduling is a cron around the same function.
- If the same run date is replayed, the report content is identical and the graph ignores it, so runs are idempotent.
