---
id: slack-engineering-capacity-2025-05-06
kind: slack_thread
date: 2025-05-06
channel: engineering
topic: internal connector estimate and CivicFlow 4.2 capacity
participants: [Piotr Kaczmarek, Lena Wójcik, Aneta Król, Karol Bąk, Ewa Mazur, Marta Zielińska]
---

# #engineering · Connector build estimate

- [08:48] Piotr Kaczmarek: For a production-quality connector, my first estimate is 16 weeks with two dedicated engineers from kickoff. That includes API work, retries, audit logs, and release testing.
- [08:55] Lena Wójcik: Are those two engineers available now?
- [09:02] Piotr Kaczmarek: No. They are assigned to CivicFlow 4.2 through 30 June. Starting now would move that release or require us to stop other committed work.
- [09:14] Aneta Król: A partner connector still needs our security review, tenant isolation checks, and a clear responsibility split for incidents. It is not zero engineering effort.
- [09:21] Karol Bąk: I am modelling the internal build at 220,000 PLN fixed first-year cost. I will mark that as an estimate and show the staffing dependency next to it.
- [09:35] Marta Zielińska: Good. Keep the 16-week number as Piotr's estimate, not a guaranteed delivery date. The 4.2 tradeoff must be visible at the decision meeting.
