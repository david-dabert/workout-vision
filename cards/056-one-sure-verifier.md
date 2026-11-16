# 056. One calibrated check decides "sure", from signals never used together
Status: ready (lab lane; ships only through the sealed exam)
Executor: careful (Claude)
Phase: 1 lab, 2 product
Claim: the app says it is sure less often when it is wrong, without changing any count.
Reference: review panel of 16 November 2026, accuracy lens. Each signal beat the shipped gate alone and was never combined (TRIED.md): loop agreement (81 % on half B, 0 off by 3), whole-set shape (85 %), learned and PSC agreement, recount spread, pose doubt, the open last rise (card 039).
Eval: a logistic model over those signals, fitted on half A, cross-validated by video, judged once on RepCount-A's held-out half (sealed, never rebuilt) and then on the sealed pool. Pass: right when sure at least 5 points above today's gate at no more than 10 points fewer sets shown as sure, none off by 3 shown as sure. Chosen on: half A. Confirmed on: RepCount-A held-out (CI's data rule).
Scope: a lab module behind a switch off in production, its bench, TRIED.md. No count changes (R2 holds).
Stop: if it fails on the held-out half, record it in TRIED.md and close.
Needs from David: nothing.
