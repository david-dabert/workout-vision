# IntelliRehabDS Clock Continuity Audit and Blocked Sessions

> **Audit Command**: `python3 scripts/benchmarks/build_rehab_sets.py`
> Protocol Check: Verification of continuous shared clock across repetition files in IntelliRehabDS (IRDS).

## Finding

Of 242 candidate sessions evaluated across the 3 mapped exercise categories (elbow flexion → `bicep_curl`, shoulder abduction → `lateral_raise`, shoulder flexion → `front_raise`):
- **170 sessions** possess a strictly monotonic, continuous shared recording clock across all repetition files and were successfully assembled into valid test sets.
- **72 sessions** contain separate, discontinuous recordings where the internal Kinect millisecond clock was reset, stopped, or restarted between repetitions (e.g. rep start time < previous rep end time).

In accordance with the instruction (*'Only when the dataset gives the timing: if the repetitions are separate recordings with no shared clock, write that in BLOCKED.md and stop'*), the discontinuous sessions cannot be assembled without fabricating a synthetic inter-repetition timebase. They are blocked and excluded from the benchmark sets.

## Discontinuous / Resetting Sessions Table

| Subject | Posture | Gesture ID | Mapped Exercise | Total Reps | Error Detail |
| :---: | :--- | :---: | :--- | :---: | :--- |
| 101 | `chair` | 4 | `lateral_raise` | 6 | Clock non-monotonic between repetitions: Rep 12 start (34063 ms) < previous rep end (54132 ms) in 101_18_4_12_1_chair.txt |
| 101 | `stand` | 4 | `lateral_raise` | 6 | Clock non-monotonic between repetitions: Rep 4 start (25464 ms) < previous rep end (38099 ms) in 101_18_4_4_1_stand.txt |
| 102 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 7 start (11802 ms) < previous rep end (22436 ms) in 102_18_1_7_1_chair.txt |
| 102 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 4 start (21399 ms) < previous rep end (33366 ms) in 102_18_1_4_1_stand.txt |
| 102 | `stand` | 4 | `lateral_raise` | 7 | Clock non-monotonic between repetitions: Rep 13 start (35836 ms) < previous rep end (55833 ms) in 102_18_4_13_2_stand.txt |
| 103 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 9 start (18129 ms) < previous rep end (33095 ms) in 103_18_1_9_1_chair.txt |
| 103 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (23434 ms) < previous rep end (39001 ms) in 103_18_1_3_1_stand.txt |
| 103 | `stand` | 4 | `lateral_raise` | 7 | Clock non-monotonic between repetitions: Rep 13 start (41967 ms) < previous rep end (64700 ms) in 103_18_4_13_2_stand.txt |
| 104 | `stand` | 1 | `bicep_curl` | 7 | Clock non-monotonic between repetitions: Rep 4 start (22665 ms) < previous rep end (42035 ms) in 104_18_1_4_1_stand.txt |
| 104 | `stand` | 3 | `front_raise` | 6 | Clock non-monotonic between repetitions: Rep 5 start (27598 ms) < previous rep end (43366 ms) in 104_18_3_5_1_stand.txt |
| 105 | `stand` | 0 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 12 start (4328 ms) < previous rep end (17330 ms) in 105_18_0_12_2_stand.txt |
| 105 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 9 start (13994 ms) < previous rep end (26727 ms) in 105_18_1_9_1_chair.txt |
| 105 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (17431 ms) < previous rep end (31330 ms) in 105_18_1_3_1_stand.txt |
| 106 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 9 start (12032 ms) < previous rep end (22364 ms) in 106_18_1_9_1_chair.txt |
| 106 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 2 start (14668 ms) < previous rep end (23833 ms) in 106_18_1_2_1_stand.txt |
| 106 | `stand` | 2 | `front_raise` | 6 | Clock non-monotonic between repetitions: Rep 3 start (52935 ms) < previous rep end (52966 ms) in 106_18_2_3_1_stand.txt |
| 107 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 9 start (14161 ms) < previous rep end (24863 ms) in 107_18_1_9_1_chair.txt |
| 107 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (13999 ms) < previous rep end (23099 ms) in 107_18_1_3_1_stand.txt |
| 201 | `wheelchair` | 0 | `bicep_curl` | 13 | Clock non-monotonic between repetitions: Rep 5 start (6694 ms) < previous rep end (16732 ms) in 201_18_0_5_1_wheelchair.txt |
| 201 | `wheelchair` | 1 | `bicep_curl` | 16 | Clock non-monotonic between repetitions: Rep 6 start (99829 ms) < previous rep end (218908 ms) in 201_18_1_6_2_wheelchair.txt |
| 201 | `wheelchair` | 2 | `front_raise` | 46 | Clock non-monotonic between repetitions: Rep 3 start (9023 ms) < previous rep end (240307 ms) in 201_18_2_3_2_wheelchair.txt |
| 201 | `wheelchair` | 3 | `front_raise` | 17 | Clock non-monotonic between repetitions: Rep 6 start (1561 ms) < previous rep end (94530 ms) in 201_18_3_6_2_wheelchair.txt |
| 202 | `stand` | 3 | `front_raise` | 2 | Clock non-monotonic between repetitions: Rep 2 start (1671 ms) < previous rep end (16865 ms) in 202_18_3_2_3_stand.txt |
| 202 | `stand` | 4 | `lateral_raise` | 38 | Clock non-monotonic between repetitions: Rep 10 start (17798 ms) < previous rep end (142399 ms) in 202_18_4_10_2_stand.txt |
| 203 | `wheelchair` | 2 | `front_raise` | 34 | Clock non-monotonic between repetitions: Rep 12 start (35632 ms) < previous rep end (197796 ms) in 203_18_2_12_2_wheelchair.txt |
| 203 | `wheelchair` | 5 | `lateral_raise` | 12 | Clock non-monotonic between repetitions: Rep 3 start (12093 ms) < previous rep end (35466 ms) in 203_18_5_3_1_wheelchair.txt |
| 204 | `chair` | 0 | `bicep_curl` | 7 | Clock non-monotonic between repetitions: Rep 4 start (34332 ms) < previous rep end (49501 ms) in 204_18_0_4_1_chair.txt |
| 204 | `chair` | 2 | `front_raise` | 64 | Clock non-monotonic between repetitions: Rep 9 start (50528 ms) < previous rep end (96174 ms) in 204_18_2_9_2_chair.txt |
| 204 | `chair` | 3 | `front_raise` | 58 | Clock non-monotonic between repetitions: Rep 37 start (39758 ms) < previous rep end (268791 ms) in 204_18_3_37_2_chair.txt |
| 204 | `chair` | 4 | `lateral_raise` | 7 | Clock non-monotonic between repetitions: Rep 4 start (77563 ms) < previous rep end (94598 ms) in 204_18_4_4_2_chair.txt |
| 204 | `chair` | 5 | `lateral_raise` | 7 | Clock non-monotonic between repetitions: Rep 5 start (53233 ms) < previous rep end (77332 ms) in 204_18_5_5_2_chair.txt |
| 205 | `stand` | 1 | `bicep_curl` | 17 | Clock non-monotonic between repetitions: Rep 8 start (67311 ms) < previous rep end (128790 ms) in 205_18_1_8_1_stand.txt |
| 206 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (22400 ms) < previous rep end (66759 ms) in 206_18_1_3_2_chair.txt |
| 206 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 9 start (66694 ms) < previous rep end (102624 ms) in 206_18_1_9_2_stand.txt |
| 206 | `chair` | 2 | `front_raise` | 9 | Clock non-monotonic between repetitions: Rep 3 start (5359 ms) < previous rep end (11508 ms) in 206_18_2_3_1_chair.txt |
| 206 | `stand` | 2 | `front_raise` | 8 | Clock non-monotonic between repetitions: Rep 9 start (90665 ms) < previous rep end (175656 ms) in 206_18_2_9_1_stand.txt |
| 206 | `chair` | 3 | `front_raise` | 12 | Clock non-monotonic between repetitions: Rep 4 start (38126 ms) < previous rep end (197014 ms) in 206_18_3_4_2_chair.txt |
| 206 | `chair` | 4 | `lateral_raise` | 11 | Clock non-monotonic between repetitions: Rep 3 start (3689 ms) < previous rep end (43150 ms) in 206_18_4_3_1_chair.txt |
| 206 | `chair` | 5 | `lateral_raise` | 16 | Clock non-monotonic between repetitions: Rep 2 start (24028 ms) < previous rep end (64732 ms) in 206_18_5_2_2_chair.txt |
| 207 | `stand` | 0 | `bicep_curl` | 21 | Clock non-monotonic between repetitions: Rep 11 start (396396 ms) < previous rep end (628450 ms) in 207_18_0_11_2_stand.txt |
| 207 | `stand` | 1 | `bicep_curl` | 15 | Clock non-monotonic between repetitions: Rep 9 start (52644 ms) < previous rep end (313137 ms) in 207_18_1_9_1_stand.txt |
| 207 | `stand` | 3 | `front_raise` | 16 | Clock non-monotonic between repetitions: Rep 16 start (98198 ms) < previous rep end (1208362 ms) in 207_18_3_16_2_stand.txt |
| 209 | `wheelchair` | 0 | `bicep_curl` | 7 | Clock non-monotonic between repetitions: Rep 7 start (6299 ms) < previous rep end (26506 ms) in 209_18_0_7_2_wheelchair.txt |
| 209 | `wheelchair` | 2 | `front_raise` | 12 | Clock non-monotonic between repetitions: Rep 3 start (3307 ms) < previous rep end (30097 ms) in 209_18_2_3_2_wheelchair.txt |
| 210 | `wheelchair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 6 start (4166 ms) < previous rep end (30265 ms) in 210_18_1_6_2_wheelchair.txt |
| 210 | `wheelchair` | 3 | `front_raise` | 5 | Clock non-monotonic between repetitions: Rep 4 start (117738 ms) < previous rep end (137831 ms) in 210_18_3_4_1_wheelchair.txt |
| 210 | `wheelchair` | 4 | `lateral_raise` | 5 | Clock non-monotonic between repetitions: Rep 2 start (33633 ms) < previous rep end (64700 ms) in 210_18_4_2_1_wheelchair.txt |
| 211 | `stand` | 0 | `bicep_curl` | 5 | Clock non-monotonic between repetitions: Rep 5 start (19132 ms) < previous rep end (43665 ms) in 211_18_0_5_2_stand.txt |
| 212 | `wheelchair` | 0 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (17801 ms) < previous rep end (29598 ms) in 212_18_0_3_1_wheelchair.txt |
| 213 | `stand` | 0 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (27963 ms) < previous rep end (42332 ms) in 213_18_0_3_1_stand.txt |
| 213 | `stand` | 5 | `lateral_raise` | 6 | Clock non-monotonic between repetitions: Rep 6 start (44766 ms) < previous rep end (61863 ms) in 213_18_5_6_2_stand.txt |
| 214 | `stand-frame` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 4 start (18794 ms) < previous rep end (32002 ms) in 214_18_1_4_1_Stand-frame.txt |
| 214 | `stand-frame` | 2 | `front_raise` | 6 | Clock non-monotonic between repetitions: Rep 5 start (91160 ms) < previous rep end (114928 ms) in 214_18_2_5_2_Stand-frame.txt |
| 215 | `stand` | 0 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 6 start (23699 ms) < previous rep end (26934 ms) in 215_18_0_6_1_stand.txt |
| 215 | `stand` | 2 | `front_raise` | 10 | Clock non-monotonic between repetitions: Rep 10 start (59531 ms) < previous rep end (76366 ms) in 215_18_2_10_2_stand.txt |
| 215 | `stand` | 3 | `front_raise` | 7 | Clock non-monotonic between repetitions: Rep 6 start (76432 ms) < previous rep end (85231 ms) in 215_18_3_6_2_stand.txt |
| 216 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (35634 ms) < previous rep end (52698 ms) in 216_18_1_3_1_stand.txt |
| 217 | `wheelchair` | 0 | `bicep_curl` | 9 | Clock non-monotonic between repetitions: Rep 3 start (7568 ms) < previous rep end (13797 ms) in 217_18_0_3_1_wheelchair.txt |
| 217 | `wheelchair` | 1 | `bicep_curl` | 8 | Clock non-monotonic between repetitions: Rep 8 start (33530 ms) < previous rep end (43467 ms) in 217_18_1_8_2_wheelchair.txt |
| 301 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (11996 ms) < previous rep end (21228 ms) in 301_18_1_3_1_chair.txt |
| 301 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 9 start (11101 ms) < previous rep end (20504 ms) in 301_18_1_9_1_stand.txt |
| 302 | `chair` | 1 | `bicep_curl` | 7 | Clock non-monotonic between repetitions: Rep 4 start (16858 ms) < previous rep end (29130 ms) in 302_18_1_4_1_chair.txt |
| 302 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 10 start (12387 ms) < previous rep end (22085 ms) in 302_18_1_10_1_stand.txt |
| 303 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (21197 ms) < previous rep end (37666 ms) in 303_18_1_3_1_chair.txt |
| 303 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 9 start (14264 ms) < previous rep end (27267 ms) in 303_18_1_9_1_stand.txt |
| 304 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (14286 ms) < previous rep end (23588 ms) in 304_18_1_3_1_chair.txt |
| 305 | `chair` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (13333 ms) < previous rep end (23033 ms) in 305_18_1_3_1_chair.txt |
| 305 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 9 start (9665 ms) < previous rep end (17367 ms) in 305_18_1_9_1_stand.txt |
| 306 | `sit` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 3 start (15131 ms) < previous rep end (27399 ms) in 306_18_1_3_1_sit.txt |
| 306 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 9 start (14171 ms) < previous rep end (26865 ms) in 306_18_1_9_1_stand.txt |
| 307 | `sit` | 1 | `bicep_curl` | 7 | Clock non-monotonic between repetitions: Rep 3 start (11400 ms) < previous rep end (25970 ms) in 307_18_1_3_1_sit.txt |
| 307 | `stand` | 1 | `bicep_curl` | 6 | Clock non-monotonic between repetitions: Rep 10 start (14065 ms) < previous rep end (25869 ms) in 307_18_1_10_1_stand.txt |

