# Truth Lab Technical Evaluation: Synthetic 3D Avatar Rendering Pipeline

## 1. Executive Summary & Audit Result
In accordance with Claude's engineering instructions for Task B5 (`antigravity/truth-lab-renders`), an audit was conducted on this macOS local machine to determine whether offline 3D skeletal rendering via Blender or a headless equivalent (e.g., `bpy`, `open3d`, `pyrender`) is currently possible.

### Audit Findings:
- **Blender CLI:** Not installed (`which blender` returned exit code 1; `mdfind` found no `Blender.app` in `/Applications`).
- **Python 3D Modules:** Neither `bpy` (Blender as a Python module), `open3d`, nor `pyrender` are installed in the active Python environment (Python 3.13.2). Furthermore, official `bpy` binary wheels on PyPI currently support Python versions up to 3.11, with experimental builds for 3.12, and are not yet released for Python 3.13 on macOS `arm64`.
- **Verdict & Blocker:** Headless 3D avatar rendering cannot execute on this host without installing external multi-gigabyte application binaries.

### Non-Compromise on Quality & Rejection of Fake Renders:
Following Claude's explicit instruction:
> *"If no: say so cleanly in docs/research/truth-lab.md, explain the blocker, and do NOT commit fake renders."*

Antigravity will **NOT** commit pseudo-3D canvas overlays, static 2D stick figures, or synthetic center-screen animations masquerading as 3D biomechanical rigs. Committing synthetic overlays without authentic 3D joint kinematic grounding directly violates WorkoutVision's core positioning: *"WorkoutVision counts and times your movement from a phone video, on the phone, and shows a number only when it can stand behind it."*

---

## 2. Technical Requirements for True Synthetic Ground-Truth Avatars

To avoid the flaws identified in the October 13 audit (where static labels floated over synthetic figures and angles were physically impossible), any future Truth Lab implementation must meet the following four technical criteria:

### 2.1 Skeletal Rigging & Anatomical Joints
- **Rig Standard:** Must use a biologically constrained kinematic skeleton (e.g., SMPL, SMPL-X, or Mixamo standard 24-joint biped rig with physiological joint angle limits).
- **Joint Grounding:** Landmark coordinates must correspond to true 3D skeletal pivot centers (e.g., the center of the acetabulofemoral ball-and-socket joint for the hip, the trochlear notch for the elbow), rather than arbitrary surface pixels.

### 2.2 Mathematical Camera Projection
The 2D screen positions $(u, v)$ must be derived by strict perspective projection of the 3D world joint coordinates $(X_w, Y_w, Z_w)$ using calibrated camera intrinsics $K$ and extrinsics $[R \mid T]$:

$$\begin{bmatrix} x_c \\ y_c \\ z_c \end{bmatrix} = R \begin{bmatrix} X_w \\ Y_w \\ Z_w \end{bmatrix} + T$$

$$\begin{bmatrix} u \\ v \\ 1 \end{bmatrix} \sim K \begin{bmatrix} x_c \\ y_c \\ z_c \end{bmatrix} = \begin{bmatrix} f_x & 0 & c_x \\ 0 & f_y & c_y \\ 0 & 0 & 1 \end{bmatrix} \begin{bmatrix} x_c \\ y_c \\ z_c \end{bmatrix}$$

- **Zero Camera Motion:** The virtual camera must remain mathematically stationary (camera velocity = 0.0 m/s, angular rotation = 0.0 deg/s). The measured camera pan across the clip must be identically $0.00\%$ under phase correlation.
- **Aspect Ratio & Framing:** Rendered at 720x1280 (vertical 9:16) or 1080x1920 @ 60.0 fps, with BT.709 color space and H.264 profile `High` with closed GOPs.

### 2.3 Transparent User-Facing Disclosures
When synthetic footage is deployed, the UI must carry prominent, uncompromised disclosures:
- Banner: `"SYNTHETIC TRUTH RIG (Blender / Mixamo), zero camera motion, 100% ground-truth landmarks"`
- Purpose: Benchmarking kinematic tracking limits and occlusion robustness, clearly distinguished from human athletic performance.

---

## 3. Recommended Provisioning Steps for Phase 2

When the development environment is provisioned with 3D authoring tools:
1. **Toolchain:** Install Blender 4.2 LTS (`brew install --cask blender` or official DMG from `blender.org`).
2. **Assets:** Download free biomechanically validated motion sequences from CMU Graphics Lab Motion Capture Database (`mocap.cs.cmu.edu`) or Mixamo sports actions (Padel smash, Freestyle swimming stroke, Track sprint).
3. **Automated Pipeline (`scripts/demo-render/truth_lab.py`):**
   - Headless script: `blender --background scene.blend --python render_truth_lab.py`
   - Exports both the 60 fps MP4 video and the synchronized `ground_truth_3d.json` containing world-space and screen-space coordinates for all 33 MediaPipe landmarks.
4. **Validation Gate:** Confirm landmark reprojection error $< 0.1$ px against the 3D ground truth.
