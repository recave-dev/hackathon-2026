---
id: agent-support-pattern-watcher-2025-11-17
kind: agent_report
date: 2025-11-17
topic: support pattern watcher run
agent: support-pattern-watcher
---

## Pattern detected

Category wrong_case_attachment has 6 tickets from 4 customers in the 60 days to 17 November 2025, and 9 tickets in total since 14 July 2025. Threshold: at least 4 tickets from at least 3 customers. Every ticket concerns the e-Doręczenia integration delivered through the partner connector. This is relevant to the open decision "Retain the partner connector, build internally, or pause e-Doręczenia expansion".

Tickets in the window:

- HD-0447 (Miasto Zielone Wzgórze, 2025-09-18): "The connector attached a message to a case, and a clerk who did not see it registered the same message manually under a new case."
- HD-0452 (Gmina Brzozowa, 2025-10-02): "An e-Doręczenia message from the tax office was attached to a building-permit case because the same sender wrote to us about a permit in March."
- HD-0455 (Gmina Lipowa, 2025-10-09): "A message concerning one resident was attached to the case of another resident with a similar sender address."
- HD-0461 (Gmina Jasna Dolina, 2025-10-23): "A follow-up letter was attached to the original case from 2024 instead of the current appeal case."
- HD-0466 (Miasto Zielone Wzgórze, 2025-11-04): "During month-end three incoming messages were attached to the wrong cases on the same afternoon."
- HD-0470 (Gmina Lipowa, 2025-11-12): "Second occurrence for us after HD-0455. An incoming message was attached to a social-welfare case although the reference in the message belonged to a permits case."

## Proposed option

Build automatic case matching for incoming e-Doręczenia messages: extend the e-Doręczenia integration so it reads the case reference number printed in every official message, proposes the matching open case, and lets the clerk confirm before attachment. Customers described this themselves in HD-0461, HD-0470. For decision: Retain the partner connector, build internally, or pause e-Doręczenia expansion.

Suggested next step: Product sizes the change and asks ConnectorCo whether reference-number matching is on their roadmap before the 19 November 2025 review. This is an agent proposal and needs human review before it counts as a decision input.
