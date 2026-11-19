# Reliability per exercise 2026-11-19

Written by `npm run reliability` (card 064, test/real-phone/reliability/table.test.ts). Measured, decides nothing. Labels are human (R1); every set read here is tuning data (PLAN.md, THE DATA), so no row reads "reliable": that takes the exam of sealed sets.
Status rule (card 064, fixed before the first run): not measured (no labelled set); too few (under 20 labelled sets that decide); fails (among the sets shown as sure, under 90 % exact, or any off by 3 or more); passes on tuning data, exam pending (otherwise). A press set decides nothing (PLAN.md).
Sources: David (stored sets), David video (whole videos read by the built app), David phone (the count his iPhone showed), and the public build halves (Countix cut to its labelled window, CFRep, MM-Fit). Synthetic: rendered sets against their exact truth, shown beside, deciding nothing.

Summary: 232 exercises offered (src/lib/offer.js, OFFERED, without the two fitness tests; variants are counted as their base exercise and not listed apart); 25 of them have at least one labelled set and 207 are not measured. Of the 29 rows below (4 of them a dataset's own key outside OFFERED): 0 pass on tuning data; 8 fail; 19 have too few sets; 2 are presses, measured, deciding nothing.

| Exercise | Tier in the app | Labelled sets | Exact | Off by 3+ | Refused | Exact share [95 % Wilson] | Shown as sure | Sure, exact | Sure, off by 3+ | Synthetic exact | Sources | Status |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---|
| squat | beta | 96 | 72 | 2 | 9 | 75 % [65, 83] | 68 | 61 | 0 | 18/24 | David, David video, cfrep, countix, mmfit | fails |
| lunge | not offered (a dataset key) | 78 | 37 | 0 | 7 | 47 % [37, 58] | 56 | 30 | 0 | - | countix | fails |
| push_up | experimental | 77 | 38 | 6 | 8 | 49 % [38, 60] | 38 | 23 | 1 | - | countix | fails |
| front_raise | experimental | 75 | 45 | 1 | 5 | 60 % [49, 70] | 54 | 37 | 0 | - | countix | fails |
| triceps_pushdown | not offered (a dataset key) | 73 | 31 | 0 | 6 | 42 % [32, 54] | 56 | 28 | 0 | - | countix | fails |
| pull_up | experimental | 60 | 19 | 3 | 7 | 32 % [21, 44] | 29 | 14 | 0 | - | countix | fails |
| overhead_press | experimental | 42 | 26 | 0 | 0 | 62 % [47, 75] | 37 | 25 | 0 | 14/24 | David, mmfit | press: measured, decides nothing |
| bench_press | experimental | 40 | 13 | 6 | 12 | 33 % [20, 48] | 14 | 10 | 0 | - | David, countix | press: measured, decides nothing |
| bicep_curl_alternating | not offered (a dataset key) | 31 | 24 | 0 | 0 | 77 % [60, 89] | 31 | 24 | 0 | - | mmfit | fails |
| lateral_raise | experimental | 31 | 21 | 0 | 0 | 68 % [50, 81] | 27 | 20 | 0 | 22/24 | David, mmfit | fails |
| dumbbell_row | not offered (a dataset key) | 19 | 8 | 4 | 0 | 42 % [23, 64] | 14 | 6 | 2 | - | mmfit | too few |
| deadlift | experimental | 6 | 3 | 0 | 0 | 50 % [19, 81] | 3 | 2 | 0 | - | cfrep | too few |
| sissy_squat | experimental | 4 | 3 | 0 | 1 | 75 % [30, 95] | 2 | 2 | 0 | - | David video | too few |
| hip_thrust | experimental | 3 | 3 | 0 | 0 | 100 % [44, 100] | 3 | 3 | 0 | - | David | too few |
| lat_pulldown | beta | 3 | 2 | 0 | 0 | 67 % [21, 94] | 2 | 2 | 0 | - | David, David video | too few |
| machine_seated_back_extension | beta | 3 | 3 | 0 | 0 | 100 % [44, 100] | 1 | 1 | 0 | - | David, David video | too few |
| bicep_curl | beta | 2 | 2 | 0 | 0 | 100 % [34, 100] | 2 | 2 | 0 | 20/24 | David | too few |
| barbell_curl | experimental | 1 | 0 | 0 | 1 | 0 % [0, 79] | 0 | 0 | 0 | - | David video | too few |
| cable_curl | experimental | 1 | 1 | 0 | 0 | 100 % [21, 100] | 1 | 1 | 0 | - | David video | too few |
| chest_supported_row | experimental | 1 | 1 | 0 | 0 | 100 % [21, 100] | 1 | 1 | 0 | - | David video | too few |
| chin_up | experimental | 1 | 0 | 0 | 0 | 0 % [0, 79] | 0 | 0 | 0 | - | David video | too few |
| dumbbell_bench_press | experimental | 1 | 0 | 1 | 0 | 0 % [0, 79] | 0 | 0 | 0 | - | David video | too few |
| hack_squat | experimental | 1 | 1 | 0 | 0 | 100 % [21, 100] | 1 | 1 | 0 | - | David video | too few |
| hanging_leg_raise | experimental | 1 | 1 | 0 | 0 | 100 % [21, 100] | 0 | 0 | 0 | - | David video | too few |
| incline_dumbbell_curl | experimental | 1 | 1 | 0 | 0 | 100 % [21, 100] | 1 | 1 | 0 | - | David video | too few |
| leg_press | beta | 1 | 1 | 0 | 0 | 100 % [21, 100] | 0 | 0 | 0 | - | David | too few |
| reverse_curl | experimental | 1 | 0 | 0 | 0 | 0 % [0, 79] | 1 | 0 | 0 | - | David | too few |
| romanian_deadlift | beta | 1 | 1 | 0 | 0 | 100 % [21, 100] | 1 | 1 | 0 | - | David | too few |
| seated_row | experimental | 1 | 0 | 0 | 0 | 0 % [0, 79] | 0 | 0 | 0 | - | David phone | too few |

Shown as sure and off by 3 or more (R16: the app is right whenever it says it is sure): 3 sets.

- push_up: countix: public/countix/build/07eq1ZyNg_U_000018_0.json.gz, label 11, counted 5
- dumbbell_row: mmfit: public/mmfit/build/w13-dumbbell_rows-31581-31942.json.gz, label 10, counted 6
- dumbbell_row: mmfit: public/mmfit/build/w13-dumbbell_rows-34932-35258.json.gz (the open last rise asks on David's #collecte phone only), label 10, counted 7
