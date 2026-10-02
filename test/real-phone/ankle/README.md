Calf raises counted by the knee-ankle-toe angle (2 October 2026). Synthetic Michelle, 10 raises each, rendered at the app size and read by the app's pose model (run.mjs), counted by core.ts with the pattern ankle/low/concentric. Truth from the skeleton.

calf_0.json.gz view 90 peak 35: truth 10 count 9 truth ankle 114-150 app 101-179 arm left rom 57,64,62,60,62,62,63,61,59
calf_1.json.gz view 90 peak 30: truth 10 count 0 truth ankle 114-145 app 103-174 arm left rom 
calf_2.json.gz view 90 peak 40: truth 10 count 9 truth ankle 114-156 app 102-177 arm left rom 57,54,55,57,67,58,55,65,58
calf_3.json.gz view 60 peak 35: truth 10 count 0 truth ankle 114-150 app 101-125 arm left rom 
calf_4.json.gz view 60 peak 30: truth 10 count 0 truth ankle 114-145 app 100-122 arm left rom 
calf_5.json.gz view 120 peak 35: truth 10 count 0 truth ankle 114-150 app 82-108 arm left rom 

Verdict: not shipped. In profile 9 of 10 at 35 and 40 degrees, 0 at 30; at 60 and 120 degrees of view, 0. The pose model reads the ankle angle over about twice the true range in profile (101-179 against 114-150) and compresses it elsewhere. The renderer keeps its calf_raise pose (synth.js) to measure a new mechanism (heel height, a foot-specific model).
