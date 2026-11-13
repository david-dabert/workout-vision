# 018. The app says it is sure only of a set filmed whole
Status: ready
Executor: careful
Claim: when the app says it is sure of a count, it is right 9 times in 10, because it is sure only of a set the video holds from rest to rest.
Reference: R16 ("right whenever it says it is sure"); `docs/FLAWS-2026-11.md` #1; TRIED.md, 11 November (six rules for the sensitivity check's question, all 58 to 61 % right when sure), 20 October (agreement of several reads: the counter is confidently wrong on about 40 % of the public sets it is sure of; its errors are systematic) and 20 October (the triage: the largest cause of undercounts is a clip that ends inside a rep, 131 of 382); TRIED.md, 9 October (the detector of a video that stops inside a rep, `openRise`, used then to ask "N or N + 1?", never to decide "sure").
Eval: bench only, nothing under `src/` changes until the rule passes. The rule is written in the card before any run: a set is "whole" when the counted joint is at rest at the first and the last sample (the detector of 9 October and the head rule's own test, read as they ship). It is tuned on David's sets and public half A only, then run once on public half B. Pass: on half B, right when sure (sure and whole) at least 90 %, and no set off by 3 or more shown as sure. The share of sets shown as sure is reported, however low.
Baseline: on the gate that ships, right when sure 408 of 678 public sets (60.2 %), 7 off by 3 or more (card 016, `sure-parity.txt`); David's sets 11 of 13.
Scope: a bench under `test/real-phone/accuracy/`, its output, TRIED.md. If it passes, a second card ships the rule through R2.
Stop: if half B misses the target, record the figures in TRIED.md and close the card as failed; do not tune on half B.
Needs from David: nothing. Note: public sets are short labelled windows (a median of 3 reps); a rule that passes there must still be measured on whole sets filmed by people (#9).
