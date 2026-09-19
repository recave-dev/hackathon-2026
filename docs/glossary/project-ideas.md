# Project ideas: a company graph for CEO decisions

## Starting point

The buyer hypothesis is a CEO of a 30–150 person B2B software company. Their problem is deciding what deserves attention, finding the relevant context before a choice, and learning whether the choice worked. The graph connects company notes, meetings, messages, customer evidence, decisions, and KPIs. Every material claim links back to its source, author, and date. External signals can enter the same graph, but an outside rule and a commercial opportunity are separate claims.

These are **alternative product entry points into one platform**, not six products to build during the hackathon. The closest match is [Topic 1: Zanim zdecydujesz](../hackathon-rules.md), which asks for scenario comparison and a decision-to-outcome learning loop. Topic 2 also fits the meeting and prioritization views.

| Idea | CEO's immediate question | Distinct value | 24-hour fit |
| --- | --- | --- | --- |
| **1. Decision Room** | “Should we build, partner, or wait?” | A sourced decision brief, editable scenarios, saved choice, and measured outcome | **Best complete MVP** |
| **2. Decision Inbox** | “Which decisions need me this week?” | Ranks candidate decisions by deadline, impact, uncertainty, and owner | Good entry screen; ranking needs careful evidence |
| **3. Opportunity Radar** | “Does this external change matter to us?” | Connects an official signal to affected customers, products, and a decision | Strong opening scene; narrow to one source |
| **4. Meeting Memory** | “What should I know before this meeting?” | Recalls promises, unresolved questions, relevant decisions, and new evidence | Fast secondary view |
| **5. Evidence Auditor** | “Which assumption is shaky?” | Shows conflicting claims and the original records behind each | Strong graph proof in one example |
| **6. Outcome Ledger** | “Did that decision pay off?” | Compares target and actual KPI and carries a lesson into the next choice | Essential closing scene |

## 1. Decision Room — recommended core

**Pitch:** Turn scattered company information into a decision the CEO can explain and revisit.

The CEO types a concrete question. The workspace shows three options, the strongest supporting and opposing evidence, unresolved questions, a previous comparable decision, and a simple scenario calculation. The CEO can change an assumption, record a choice and rationale, set a KPI target and review date, then later import an actual result.

**Demo:** A fictional software company decides whether to build an e-Doręczenia integration, use a partner, or postpone. Show verified customer requests beside a larger but unverified sales claim; change the partner adoption forecast and see the calculation update. Save a pilot decision, then reveal six actual paid activations against a target of ten. The exact consistent case is in the [synthetic scenario](../synthetic-decision-scenario.md). All company messages, forecasts, and outcomes are synthetic; the government notice is cited separately.

**24-hour boundary:** One prepared decision, three options, a few source types, transparent arithmetic, one saved decision, and one later KPI import. The graph must retrieve real linked records rather than display a prewritten answer.

## 2. Decision Inbox

**Pitch:** Help the CEO choose what to decide before helping them decide it.

Meeting notes and messages identify candidate decisions such as a looming customer commitment, a delayed product release, or a partner choice. Each inbox item shows why it is here: deadline, affected revenue or customers, unresolved dependencies, owner, and a link to a Decision Room. The CEO can dismiss, defer, or open it.

**24-hour boundary:** Three seeded decisions and an explainable priority order based on explicit fields. Avoid an opaque “AI importance score” or an unsupported monetary impact estimate. This speaks directly to the Rekord SI CEO's reported prioritization problem, but by itself covers less of Topic 1's outcome loop.

## 3. Opportunity Radar

**Pitch:** Translate a change outside the company into a specific decision inside it.

An official notice enters as a dated source. The app links it to a customer segment and product, states the plausible business implication, and creates a question for the CEO: “Should we offer an integration?” It distinguishes what the source says from what the company still needs to validate, such as willingness to pay.

**24-hour boundary:** One manually supplied official notice and one reviewed graph update. A continuous legal monitoring agent across jurisdictions is a later product. The e-Doręczenia example should be presented as a **historical replay**, not as a newly announced 2026 requirement.

## 4. Meeting Memory

**Pitch:** Arrive with the decisions, promises, and disagreements already in view.

Select a customer or leadership meeting. The brief shows what changed since the previous meeting, commitments and their owners, claims that disagree, the decision needed today, and links to the original notes or messages. Afterward, ingest the new meeting note and connect its decisions and actions to existing entities.

**24-hour boundary:** One meeting before-and-after flow on the same fictional company graph. It should reuse the Decision Room's evidence rather than become a separate summarization app.

## 5. Evidence Auditor

**Pitch:** Expose the weak link in a business case before it becomes a decision.

The graph preserves a sales statement and the underlying customer records as separate claims. The CEO sees that “twelve interested customers” is not equivalent to “four written requests,” who said each thing, when, and what would resolve the gap. A review action can mark a claim verified, disputed, or superseded without deleting its history.

**24-hour boundary:** One deliberate contradiction, two or more source links, and one review action. The novelty is evidence provenance and correction, not merely a warning icon.

## 6. Outcome Ledger

**Pitch:** Make the next decision better by checking how the last one actually performed.

Every recorded choice has an owner, an expected KPI, a measurement date, and its assumptions. A later KPI observation is linked to the decision, so the app shows forecast versus actual and a human-reviewed lesson. Related decisions retrieve that lesson along with its sources. It must not claim to know how an unchosen option would have performed.

**24-hour boundary:** One previous decision, one actual KPI update, and a second decision where the lesson appears. This is part of the recommended Decision Room flow, not an optional dashboard.

## What to build

Build **Decision Room + Outcome Ledger** as one working vertical slice. Use **Opportunity Radar** as the opening trigger and a single **Evidence Auditor** conflict in the decision view. If time remains, add a compact Meeting Memory brief or Decision Inbox using the same records. The [MVP scope](../mvp-scope.md) has the full demo sequence and build boundary; the [graph and ingestion design](../graph-and-ingestion-design.md) describes how source-backed claims and relationships can support it.

The winning demo question is concrete: **“Should we build the e-Doręczenia connector, partner, or wait?”** Judges can inspect the sources, adjust an assumption, save the choice, observe a KPI result, and see that lesson inform a later decision. That proves the graph helps with a real decision instead of only making a visually impressive network.
