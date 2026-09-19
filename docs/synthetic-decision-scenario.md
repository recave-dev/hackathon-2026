# Synthetic demo case: build or partner for an e-Doręczenia integration

## Why this case

This is a recognizable IT-company decision with a real external trigger, conflicting internal evidence, three defensible options, and a measurable outcome. It exercises the whole [MVP decision graph](mvp-scope.md) in one story. **Aster Systems, its people, customers, vendor, prices, forecasts, and results below are fictional.**

The public facts are narrower: Poland's [official e-Doręczenia schedule](https://www.gov.pl/web/e-doreczenia/harmonogram) describes phased obligations for public bodies, and the [government API page](https://www.gov.pl/web/e-doreczenia/interfejsy-api) describes UA API for messages and SE API for address lookup. The law does **not** require municipalities to purchase Aster's integration. Whether they would pay for workflow automation is a commercial question. This case is a historical replay set in 2025, not a new 2026 law alert.

## The CEO's question

> “Should Aster Systems build an e-Doręczenia connector into our municipal document product, buy a partner connector, or postpone it?”

Decision date in the fictional timeline: **12 May 2025**. The CEO wants a workable offer ahead of the [end of the public-sector transition period](https://www.gov.pl/web/e-doreczenia/e-doreczenia--koniec-okresu-przejsciowego-dla-podmiotow-publicznych) on 31 December 2025. The company has **60 municipal customers**. Four have explicitly requested an integrated workflow; a sales Slack thread says twelve are “interested,” without naming all twelve. Two engineers could work on the connector but are currently committed to another product milestone.

The app should show this as a decision under uncertainty. It should never turn “12 interested” into “12 committed buyers.”

## Three options and editable first-year model

All figures are **synthetic demo assumptions**, in PLN. “Contribution per paid customer” means first-year revenue from this offer after direct per-customer delivery costs. Fixed costs include launch and first-year operating costs. The model is `estimated contribution = paid customers × contribution per customer − fixed cost`.

| Option | Launch time | Forecast paid customers in first 12 months | Contribution per paid customer | Fixed first-year cost | Modelled first-year contribution | Main tradeoff |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| **A. Build internally** | 16 weeks | 18 | 20,000 | 220,000 | **140,000** | Product control and better unit economics; later release and engineering diverted from roadmap. |
| **B. Buy/partner with fictional ConnectorCo** | 6 weeks | 22 | 14,000 | 110,000 | **198,000** | Faster release; partner dependency, lower per-customer margin, contract and integration questions. |
| **C. Postpone** | No release | 0 | 0 | 0 | **0** from this offer | Preserves capacity; potential missed sales and customer frustration are unknown, not assigned a fabricated loss. |

The first-year arithmetic makes B look attractive **if** the adoption forecast is credible. Change B's paid-customer forecast from 22 to 14 and its modelled contribution falls to **86,000**, below A's 140,000. The decision page should update this live and keep the two forecasts visible as assumptions, not facts. A longer horizon may favor A because B has lower unit contribution; the MVP does not need to predict the exact crossover.

**Decision-relevant nonfinancial criteria:** time to market, API compatibility, operational control, customer data handling, vendor exit terms, delivery capacity, and effects on the existing roadmap. Show these beside the calculation rather than burying them in one opaque “AI score.”

## Graph evidence to synthesize

| Source | Dated content to generate | Graph links / purpose |
| --- | --- | --- |
| Official gov.pl schedule and API description | Affected public entities, rollout dates, UA API and SE API roles | External signal → affected customer segment → product integration candidate. Keep original URL and retrieval date. |
| `company-profile.md` | Aster has 60 municipal customers and sells document workflow software | Company → product → customer segment. |
| `slack/sales.json` | Sales lead says “twelve municipalities are interested” | Unverified claim → e-Doręczenia opportunity; contradicts the verified demand count. |
| `emails/customers.csv` | Four distinct municipal customers request an integrated workflow; one asks about launch timing | Four sourced requests → customer entities → demand evidence. |
| `slack/engineering.json` | Engineering estimates sixteen weeks to build and says two engineers are on another milestone | Build option → timeline and capacity risk. |
| `emails/vendor.csv` | Fictional ConnectorCo offers a six-week path with the assumed commercial terms | Partner option → cost and dependency. |
| `notes/previous-decision.md` | A prior digital-signature feature was forecast for 25 customers but reached 14 after a year | Past decision → expected KPI → actual KPI → lesson: validate demand before full build. |
| `meetings/2025-05-12.md` | Leadership reviews the options and records a decision | Meeting → decision → owner, rationale, expected KPI, review date. |
| `kpis/activations.csv` | Later paid activations for the chosen option | Outcome → measured decision → next decision's context. |

Build the corpus from one canonical fact sheet so names, dates, and values agree across files. The contradiction between “twelve interested” and “four verified requests” is intentional and must remain visible with provenance. If the team adds a customer meeting brief, use these same sources.

## Unknowns and the research action

| Unknown | Correct behavior |
| --- | --- |
| “Which entities and dates does the public obligation cover?” | Research the named official gov.pl schedule, cite the relevant passage, and present it for acceptance into the graph. |
| “Will ConnectorCo meet our security and exit requirements?” | Mark unresolved; assign legal/engineering review to an internal owner. Public web research cannot verify a private offer. |
| “Will 22 customers pay?” | Keep as an editable forecast. Ask sales for named evidence or test a pilot; do not manufacture a probability. |

## Decision and outcome replay

For the synthetic demo, the CEO chooses **B: a paid partner pilot**, with a review gate before a broader rollout. The recorded rationale is speed, four verified requests, and the ability to test demand without diverting both engineers for sixteen weeks. The owner is the product lead. The primary KPI is **paid municipal activations six months after the decision**; the target is **10**.

A dated synthetic KPI import at the six-month review shows **6 paid activations**. The app displays `6 actual / 10 target`, lists the sources behind the number, and records a lesson: “Early expressions of interest overstated near-term willingness to buy; require named customer commitments before forecasting broader uptake.” When the CEO later asks whether to replace the partner connector with an internal build, this prior outcome appears automatically. The result does not prove that A would have performed better; that counterfactual is unknown.

## Three-minute demonstration

1. Show the official external signal linked to Aster's product and customers. Open the CEO's build/partner/postpone question.
2. Reveal the graph's four verified customer emails, the sales claim of twelve, the engineering constraint, vendor offer, and the prior feature's forecast-versus-actual result. Open at least two original sources.
3. Compare A, B, and C. Change B's paid-customer assumption from 22 to 14; its estimated contribution changes from 198,000 to 86,000 PLN.
4. Choose the partner pilot, record the reason and six-month KPI target.
5. Import the later KPI row, show 6 versus 10, then open a related decision to show the lesson carried forward.

**Demo pass condition:** the sources, option arithmetic, saved decision, and outcome update are real application state. Prepared questions and synthetic documents are fine; a hard-coded answer screen is not.
