# Copy: exercise names brought to the glossary (3 October 2026)

For David's approval before release (R10). Register "vous" elsewhere; a name has none.

## Changed 3 October 2026 (third audit C46): pending David's approval (3 October)

"Poussée triceps poulie" was a word-for-word calque of "triceps pushdown". DIRECTIVES.md Part 7 gives
"Extension triceps a la poulie haute", which also matches the app's other triceps names ("Extension triceps à la
corde", "Extension triceps au-dessus de la tête").

| Key | French (was) | French (now) | English | Where |
|---|---|---|---|---|
| ex.tricep_pushdown (fr.json) | Poussée triceps poulie | Extension triceps à la poulie haute | Tricep Pushdown | Exercise list, film screen, history, report |
| ex.cable_tricep_pushdown (fr.json) | Poussée triceps poulie | Extension triceps à la poulie haute | Cable Tricep Pushdown | Same, for the older key |
| tricep_pushdown.fr (guide-catalog.json) | Poussée triceps poulie | Extension triceps à la poulie haute | Tricep Pushdown | Guide and the exercise list |

The old name stays among the catalog's search aliases, so a search for "poussée triceps" still finds it.
Layout: on the film screen the name takes two balanced lines at 320 and 375 px with no layout fault
(test/real-phone/checks.mjs layoutFaults), and e2e/exercises.spec.js (no list name over two lines at 320 px) passes.
