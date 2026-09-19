# Canonical fact sheet — fictional Aster Systems

## Company and people

- Aster Systems is a fictional Polish B2B software vendor with 100 employees and 60 municipal customers as of May 2025.
- CivicFlow is its municipal document-workflow product. CivicFlow 4.2 is a separate scheduled release.
- Marta Zielińska is CEO; Tomasz Nowak is Sales Lead; Lena Wójcik is Product Lead; Piotr Kaczmarek is Engineering Lead; Ewa Mazur is Customer Success Lead; Aneta Król is Security Lead; Karol Bąk is Finance Lead and approves or rejects tooling purchases in `#purchase-requests`.
- ConnectorCo is a fictional prospective integration vendor.
- Four fictional municipal customers sent explicit pre-decision requests: Gmina Brzozowa, Miasto Srebrne Pole, Gmina Jasna Dolina, and Miasto Zielone Wzgórze. All email addresses use `.example` and are nonfunctional.

## Decision chronology

| Date | Event |
| --- | --- |
| 2024-04-18 | Aster approves an internal digital-signature feature with a target of 25 paid customers in 12 months. |
| 2025-04-18 | Actual digital-signature uptake is 14 paid customers. |
| 2025-04-24 to 2025-05-02 | Four named customers request an integrated e-Doręczenia workflow. |
| 2025-05-02 | Sales reports twelve municipalities “interested”; the full named list and buying intent are unverified. |
| 2025-05-05 | ConnectorCo offers a six-week implementation path from kickoff, conditional on technical and security review. |
| 2025-05-12 | CEO approves a paid partner pilot, subject to a security/contract gate. Product Lead owns it. |
| 2025-05-20 | Security gate passes for a limited pilot with conditions recorded in the meeting. |
| 2025-06-23 | Pilot launches after roughly six weeks of work from the 12 May kickoff. |
| 2025-11-12 | Six-month result: six paid municipal activations versus a target of ten. |
| 2025-11-19 | Leadership opens a new decision about retaining the partner or building internally; no choice is recorded yet. |

## Tooling purchase chronology, all synthetic EUR figures

| Date | Request | Outcome |
| --- | --- | --- |
| 2025-05-14 | Tomasz Nowak requests Pipedrive Advanced, five seats, 34 EUR per seat, 170 EUR per month, to track the named pilot pipeline. | Karol Bąk approves on 2025-05-15 with a 200 EUR monthly cap; Tomasz owns seats and the November cancellation review. |
| 2025-06-10 | Ewa Mazur requests Intercom Essential at 74 EUR per month for pilot onboarding chat. | Rejected; revisit if paid activations pass ten. |
| 2025-07-08 | Tomasz Nowak requests the Pipedrive LeadBooster add-on at 32.50 EUR per month. | Rejected; revisit after 12 November. |
| 2025-09-02 | Tomasz Nowak and Ewa Mazur request three more Pipedrive seats for Customer Success, eight seats and 272 EUR per month. | Karol Bąk approves on 2025-09-03 from 1 October with a 300 EUR cap. |
| 2025-06-01 to 2025-11-01 | Six monthly Pipedrive invoices to finance@aster.example: 170 EUR in June, July, August and September, 272 EUR in October and November. | Total 1,224 EUR. |

## Support ticket pattern

Between 14 July and 12 November 2025 the helpdesk received nine tickets from four pilot municipalities (Gmina Brzozowa 4, Gmina Jasna Dolina 2, Miasto Zielone Wzgórze 2, Gmina Lipowa 2; HD-0412, 0431, 0436, 0447, 0452, 0455, 0461, 0466, 0470) about incoming e-Doręczenia messages attached to the wrong CivicFlow case. Cause in the fiction: the partner connector matches on sender, not on the case reference number. Sixteen other tickets are ordinary access, training, export and delivery-status issues. The support pattern watcher agent fires on 17 November 2025 with six tickets from four customers in its 60-day window and proposes automatic case matching as an option for the 19 November decision. Leadership on 19 November had not yet seen a support summary.

## Decision assumptions, all synthetic PLN figures

The model is `first-year estimated contribution = forecast paid customers × contribution per paid customer − fixed first-year cost`. Figures are **assumptions**, never observed financial results.

| Option | Launch | Forecast customers in first 12 months | Contribution per customer | Fixed first-year cost | Estimated first-year contribution |
| --- | --- | ---: | ---: | ---: | ---: |
| Build | 16 weeks with two dedicated engineers | 18 | 20,000 | 220,000 | 140,000 |
| Partner | 6 weeks from kickoff | 22 | 14,000 | 110,000 | 198,000 |
| Postpone | No launch | 0 | 0 | 0 | 0 from this offer |

If partner uptake is 14 rather than 22, estimated contribution is 86,000 PLN. The partner option also has a distinct six-month pilot target of **10** paid activations; its later actual is **6**. The two engineers needed for an internal build are assigned to CivicFlow 4.2 through 30 June 2025. The unknowns are willingness to pay, partner exit terms, and longer-term support burden. No unchosen option has an observed outcome.

## Evidence rules

- “Four written requests” is a count of named source emails, not four purchase commitments.
- “Twelve interested” is Sales Lead's reported pipeline estimate, not twelve verified or paying customers.
- Government rollout may create a relevant market signal; it does not mandate purchase of CivicFlow or ConnectorCo.
- Aster's target and forecasts are separate from later KPI observations.
