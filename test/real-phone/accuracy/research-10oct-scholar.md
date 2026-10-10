<!-- Written by the literature sweep of 10 October 2026 (eleven agents: four searches, six adversarial checks, one synthesis; read-only). Its notes and scripts are in the session scratchpad (scratchpad/scholar/), outside the repository. Papers were read at abstract level unless said otherwise: this environment could not reach Google Scholar or most publishers. -->

# Is there a published fix for our counting accuracy?
Scholar check, 10 October 2026, read-only on the repository.

## 1. Did Google Scholar answer

No. Google Scholar could not be reached, so no search ran and no CAPTCHA appeared.
curl was refused by the egress proxy ("CONNECT tunnel failed, response 403"), and WebFetch failed with "getaddrinfo ENOTFOUND scholar.google.com".
OpenAlex, Semantic Scholar, Crossref, doi.org, arXiv, PMC, MDPI, IEEE, Springer, PLOS, Frontiers and JMIR were refused the same way.
These sources did work:
- a search engine that returns its own summaries of pages;
- the Hugging Face papers API, for arXiv abstracts;
- raw GitHub, for the authors' code;
- one full text, RecoFit, from microsoft.com.

So every other paper below was read at abstract level at most.
Notes from the four search angles are in scratchpad/scholar/.

## 2. Is there a published solution?

Partly, and only in theory.
I found no counting paper that measures counts that change when the same video is re-encoded.
The cause is published: a pipeline that detects the person first and then crops turns the detector's small shifts into joint jitter (Wang et al., WACV 2025, search summary, https://openaccess.thecvf.com/content/WACV2025/papers/Wang_Shift_Equivariant_Pose_Network_WACV_2025_paper.pdf).
Our data agrees: a fixed crop with no detector raised David's exact reads from 11 to 21 of 39 (scratchpad/scholar/stabtrain/check.md).
That fixed crop still failed on public Countix (TRIED.md line 129).
The published fixes we can build without retraining failed on our data or were already closed: input blur, smoothers and crop votes.
One published method targets the cause and has not been tried here: retrain the landmark network so it gives the same answer on slightly changed inputs.
Nobody has shown it working on pose or on counting.

## 3. Candidates that survived verification

One of six survived.

**Stability training of MediaPipe's landmark model** (Zheng, Song, Leung, Goodfellow, CVPR 2016, abstract only, https://arxiv.org/abs/1604.04326).

What it is:
- The network is fine-tuned so its output stays the same on slightly changed copies of each frame.
- The frozen original model is the teacher, so no labels are needed.

Evidence, as read:
- The paper makes an image classifier stable against compression, rescaling and cropping. It has no pose or video results.
- Closest analogue: fine-tuning cut the cases where phones gave different predictions by 75 % (Cidon et al., MLSys 2021, search summary, https://arxiv.org/abs/2010.09028).
- Against it: data augmentation alone "offers relatively small robustness" to shifts (Engstrom et al., abstract, https://arxiv.org/abs/1712.02779).

Why it fits our failure:
- It keeps the crop that follows the body.
- It teaches the network to ignore the crop and codec changes behind our one-limb glitches.
- Example: the seated press counted 9 for 7 on the phone but 7 on a desktop read of the same set (TRIED.md line 58).

Cost on the phone: none at run time.
The model is 6,438,874 bytes and uses only built-in TFLite operations, so a retrained copy drops in with the same speed (scratchpad/scholar/stabtrain/check.md).

Limits:
- It takes days of offline work.
- Every labelled set has to be re-read.
- Little gain is expected on public sets: per-frame noise moves the public deciding exact count only between 425 and 436, against 431 today (TRIED.md line 103).

Experiment, with the rules fixed before any run:
- Size the training jitter to the p99 of how the detector's crop differs between encodings on David's 13 videos.
- Port the model and prove its outputs match the original to within 1e-4 on 200 frames, before any training.
- Train on about 20,000 RepCount-A training frames only. The teacher target is the median over 8 crops. The training copies use HEVC, H.264, VP8 and VP9 at CRF 18-35.
- Stop early unless the p90 angle spread between encodings falls by at least 30 % on at least 9 of 13 videos, and the p99 also falls.
- Pass rule:
  - exact count on each of the six encodings not below today's 6, 5, 3, 1, 2, 3 of 14 (TRIED.md line 103);
  - on Countix halves A and B: exact not lower, off by 3 or more not higher, no set newly off by 3;
  - synthetic exact not lower;
  - then David confirms on his iPhone.

## 4. How accurate are systems like ours in real conditions?

One phone-camera pose counter was tested over 12 camera placements (Oliosi et al., JMIR mHealth 2026, abstract only, https://doi.org/10.2196/82412).
It counted exactly 61.1 % of push-up videos and 61.5 % of squat videos, with a mean error of 1.08 and 1.11 reps.
Its best placement reached 95.5 % for squats, and its worst reached 0 % (same source).
Two identical wrist counters worn on the same wrist gave exactly the same count 59.6 % of the time, and agreed within one rep 83.7 % of the time (Montoye et al. 2019, abstract only, https://doi.org/10.1123/jmpb.2018-0071).
Our six encodings give the same count 57.7 % of the time (test/real-phone/stability/stability.txt).
They agree within one rep 83.1 % or 85.0 % of the time, depending on how refused reads are treated (scratchpad/scholar/pm1.py).
Phone apps that track the barbell missed 8.8 % and 29.7 % of 589 reps (Renner, Mitter, Baca, PLOS ONE 2024, abstract only, https://doi.org/10.1371/journal.pone.0313919).
A camera counter tested in a real gym averaged an error of 1.7 reps (GymCam, IMWUT 2018, abstract only, https://doi.org/10.1145/3287063).
Lab papers report 97.2 % (https://doi.org/10.3390/jfmk11020162) or 98.89 % (https://huggingface.co/papers/2308.02420), but per rep, not as exact counts per set.
Most of the field reports accuracy within one rep, not exact counts.
Our exact rates come from the 10 October brief: about 46 % on public sets, and 59 % on real sets shown as sure.
They sit in the same range as the one comparable real-world study.

## 5. Rejected

- Oblique filming (Oliosi 2026): on CF-Rep squats, side view is exact on 8 of 8 and the diagonal view on 4 of 7 (scratchpad/scholar/validity-oliosi/cfrep-view.txt).
- Wrist-counter benchmark (Montoye 2019): it fixes nothing, and its 84 % pass mark passes or fails depending on how refused reads are counted (scratchpad/scholar/pm1.py).
- Input blur (Azulay and Weiss 2019, Zhang 2019, Xu 2018): the angle spread narrowed on only 2 of 4 videos, and poses were lost (scratchpad/scholar/notes.md).
- Choosing the limb nearer the camera (Wade 2023): it changed 0 of 1,262 counts (scratchpad/scholar/nearside/analyze.txt).
- Blind human recount (JPES 2021): disagreement between encodings involves no label, so a recount cannot explain it; it is already plan.md item B.4.
- EKS smoother (Lightning Pose 2024) and Anipose Viterbi: no gain over the crop vote, and the crops they rely on failed on Countix (scratchpad/scholar/eks/).
- Not verified, with the reason each ranked low:
  - shift-equivariant pose network: a new architecture that has to be trained;
  - box fusion: medians of crops gave nothing before;
  - artefact correction: a second network on every frame;
  - optical-flow veto and Pūioio: image motion already failed (TRIED.md lines 70 and 73);
  - two-angle check per rep: its reported gain came from persistence, already tried;
  - weight tracking: already research-9oct.md shortlist 2;
  - skeleton learned counter: learned counters failed (TRIED.md lines 62 and 84);
  - tempo breakdown, Wellnify and GymCam: measurement only.
- Not verified and still open. Each is a change to the counter's rules, like the 31 that failed:
  - rejecting a sample that disagrees with the other limb (Li 2008);
  - RecoFit's local period (2014);
  - choosing the channel per window (Johnson 2015);
  - a duration-based HSMM (Springer 2016);
  - TERMA (Elgendi 2013);
  - a first rep dropped only when two conditions both hold (Pham 2018).
