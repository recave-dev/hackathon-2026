# Hackathon MVP: a decision graph for a CEO

## Recommendation

Build **one company decision graph** from a fictional firm's Slack export, email export, Markdown notes, meeting notes, a KPI file, and one authoritative external notice. Let a CEO enter a decision question, see the sourced context and options, record a choice, and later compare the result with the expected KPI. Use the same graph to show five compact CEO use cases.

**One-sentence pitch:** “From scattered company knowledge to a decision you can explain—and later learn from.”

**Hackathon track:** Topic 1, *Zanim zdecydujesz*. The current concept directly covers its required sequence: past decisions and KPIs → scenario comparison → decision → monitoring actual outcome → learning for the next decision. Meeting briefs and external alerts are entry points into that sequence. See the [rules and scoring](hackathon-rules.md).

**First buyer hypothesis:** CEO of a 30–150 person Polish B2B software vendor serving regulated customers. This narrows the original 1–250 person range enough to produce one realistic corpus and decision. Rekord SI is a useful interview partner; its [career page](https://www.rekord.com.pl/kariera/) lists 132 employees. Its CEO's reported e-Doręczenia revenue is an interview anecdote until the chronology and outcome are confirmed.

## Five CEO use cases, one connected story

Use a fictional 100-person company, **Aster Systems**, selling document-workflow software to Polish municipalities. All internal names, messages, figures, and outcomes are labeled synthetic. The external e-Doręczenia timeline is sourced from the [official government schedule](https://www.gov.pl/web/e-doreczenia/harmonogram); the demo is a **historical replay**, since the underlying law dates from 2020 and public-sector rollout began in 2025.

The concrete build-versus-partner choice, consistent fictional numbers, source list, and outcome replay are specified in [synthetic-decision-scenario.md](synthetic-decision-scenario.md).

| # | CEO question and value | What the demo shows | Value / 24h effort | Depth |
| --- | --- | --- | --- | --- |
| 1 | **“Should we build the e-Doręczenia integration, partner, or wait?”** Assemble the case for an important decision. | Decision page with cited customer demand, past comparable decision, capacity, two or three options, editable assumptions, risks, unknowns, and expected KPI. CEO records a choice. | 5/5 value, 4/5 effort | **Full vertical slice** |
| 2 | **“What must I know before tomorrow's customer or steering meeting?”** Stop repeating known status. | Brief with what changed, prior promises, the decision due in the meeting, conflicting claims, and source links. | 4/5 value, 2/5 effort | Thin view of the same graph |
| 3 | **“Does this outside change create an opportunity for us?”** Catch relevant external signals. | One government notice enters the graph and links to a product, affected customer group, and candidate decision. Show why it matters and its effective date. | 4/5 value, 3/5 effort | One-source demonstration |
| 4 | **“What do we believe that might be wrong?”** Prevent decisions based on inconsistent reports. | Sales says ten customers are interested; account notes verify two. Both claims retain author, date, and source. The brief asks the CEO to resolve or investigate the gap. | 4/5 value, 2/5 effort | One deliberate conflict |
| 5 | **“Did our last decision work?”** Close the loop. | Upload a later KPI row, compare expected and actual results, record a lesson, and surface it when the next comparable decision opens. | 5/5 value, 2/5 effort | Required completion of use case 1 |

These are **five use cases, not five independent products**. They should appear as five prepared demo questions that reuse the same entities, evidence, decisions, and metrics. Build #1 and #5 as one complete flow; #2–4 can be concise views and actions on that flow.

## Rating and market test

**Concept: 8/10. Current proposed build breadth: 5/10 for a 24-hour hackathon. Focused plan above: 8/10 execution potential.** These are our planning judgments, not predicted judge scores.

- **High value:** It addresses the CEO's reported prioritization and context problem, and Topic 1 rewards a decision-to-outcome loop. A [2026 Vistage survey](https://vistage.com/research-center/business-financials/economic-trends/current-climate-dampens-ceo-confidence-q2-vistage-ceo-index/) also reports CEO overload and gaps in execution, though it is a US sample and does not validate demand in Poland.
- **Crowded space:** [Glean](https://www.glean.com/enterprise-search) has an enterprise graph and search; [Microsoft Copilot](https://support.microsoft.com/en-us/outlook/prepare-for-your-meeting-with-copilot) prepares meeting context; [FiscalNote](https://fiscalnote.com/products/policynote) monitors policy and analyzes company impact; [Cloverpop](https://www.cloverpop.com/decision-intelligence-platform) explicitly covers decision graphs, agents, options, and outcomes. No single feature here is a unique category.
- **Working edge to test:** A quick, evidence-linked decision workspace for a smaller firm's CEO, using files they already have, with unknowns and real outcome checks. Ask the CEO whether this workflow is more useful than their existing notes and AI tools.
- **Main failure mode:** Five polished screens can look impressive while the graph, citations, and decision state are fake. The judge should be able to change an input, save a decision, add a KPI result, and see the answer change.

## The core product loop

1. **Ingest:** parse a small set of source documents. Store full raw text, source type, author, time, and a stable link/ID.
2. **Build the graph:** extract entities (customers, products, people, projects), sourced claims, decisions, commitments, and KPI observations. Link them by topic and time. Human edits can correct entity matches and claim status.
3. **Open a decision:** CEO enters “Should we build e-Doręczenia integration?” Retrieval finds the relevant graph neighborhood and recent evidence. The page separates *known facts*, *claims*, *assumptions*, *contradictions*, and *unknowns*.
4. **Resolve unknowns:** for an external verifiable question, a bounded research action checks named authoritative sources and returns cited evidence. For an internal unknown, create a question for its owner. For an unknowable future outcome, show an editable assumption and sensitivity, not a fabricated probability. Add research findings to the graph only after review.
5. **Compare options:** simple, transparent calculations from editable inputs (for example build cost, time to market, plausible customer uptake). Show downside and dependencies. Do not present an LLM's unsupported numbers as forecasts.
6. **Decide and learn:** save option, rationale, owner, expected KPI, and review date. Import a later KPI result, compare expected versus actual, and attach a lesson to future related decisions.

The graph should represent **claims with provenance**, not treat every extracted sentence as a true fact. Minimum relationships: `source supports claim`, `claim concerns customer/product`, `claim contradicts claim`, `decision considered option`, `decision relied on claim`, `decision targets KPI`, and `outcome measures decision`. Include dates so a newer statement can supersede an older one. A relational database with link tables is enough; graph visualization is optional.

## Synthetic company corpus

Create one coherent, dated scenario rather than random messages. Suggested minimum:

| Data | Approximate size | What it must prove |
| --- | --- | --- |
| Slack export | 35–50 messages in 5–7 threads | Sales interest, product capacity, one contradiction, discussion of options |
| Email export | 8–12 messages | Customer requests and a promise/deadline |
| Markdown notes and meeting notes | 8–12 files | Prior context, one past comparable decision, two meetings, next actions |
| KPI CSV | 8–12 dated rows | Baseline, expected metric, and later actual for a prior and current decision |
| Company profile | 1 file | Products, customer segments, strategic priorities |
| Official external source | 1 government notice/schedule | A verified change with affected group and effective date |

Generate the corpus from a **single fact sheet** listing canonical customers, dates, owners, product names, and KPI values. Add intentional contradictions only where the demo will show them. This avoids a synthetic dataset that disagrees with itself accidentally. Label all generated internal material and numbers as synthetic; keep the official source visibly separate.

## 24-hour build boundary

**Must work:** import the synthetic files; build and persist source-linked nodes/links; open a decision by question; show a credible evidence page with at least three source types; edit an assumption and see an option calculation change; save the decision; import one KPI observation and show expected versus actual; reopen a related decision and show the past lesson. The meeting brief, external-signal card, and contradiction view reuse these same records.

**Bounded research action:** one “Investigate” button for a selected external unknown, restricted to the supplied government source or another explicitly chosen primary source. It must show what it checked and permit the CEO to accept or reject the result. A live general web research swarm is outside this MVP.

**Outside the MVP:** production Slack/email OAuth, whole-company ingestion, automatic monitoring of all laws or news, enterprise permissions, a large interactive graph, autonomous business decisions, automatic messages to colleagues, causal forecasts, and a generic chat assistant.

**Implementation order:** hours 0–2 lock story and fact sheet; 2–7 generate and validate corpus plus schema; 7–16 import, graph, and decision page; 16–20 scenarios, decision save, and KPI update; 20–24 other entry views, test, and rehearse. Cut the bounded research action before cutting source links or the outcome loop.

## Three-minute demo script

1. **20 seconds:** CEO sees an external e-Doręczenia signal and opens the linked decision.
2. **80 seconds:** decision page connects government source, customer emails, Slack, prior meeting, and KPI. Show one contradiction and one unknown. Edit a cost assumption; the options update.
3. **35 seconds:** CEO chooses the pilot/build option, records reason and expected KPI.
4. **30 seconds:** import a later synthetic KPI row; expected versus actual and the lesson appear.
5. **15 seconds:** open tomorrow's meeting brief or a related decision; the recorded choice and lesson are already there.

**Acceptance test:** a judge can click through each cited item, alter at least one input, see a different calculation, save a decision, and observe a later KPI update without editing code.

## Questions to settle in the first hour

1. What single real decision from the Rekord SI CEO best resembles this flow? What options did he consider?
2. What were the actual sources, missing inputs, and follow-up KPI? Can the team use an anonymized version, or should the demo remain fully fictional?
3. Which five prepared questions would he actually ask a system like this? Rank them before building the navigation.

At minute 60, lock **one buyer, one company, one decision, one expected KPI, one later outcome, and the five demo questions**. The product is ready to build once those fit on one page.
