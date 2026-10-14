#!/usr/bin/env python3
"""
WorkoutVision Demo Video Renderer

Draws genuine offline MediaPipe Pose skeletons locked directly to athlete joints
and optional measurement cards from Claude's measures JSON specification.

Features:
- Refusals rendered in full without numeric values when 'refused' is set.
- Lifetime control: measure displayed from t_ms until next frame's t_ms or until_ms.
- Precision control via optional per-item 'decimals' field (default 0).
- Dynamic multi-row text layout with word wrapping and shrink-to-fit (never clips).
- Nearest t_ms landmark matching (not frame index).
- 12 major body joints + nose drawn with antialiased lines scaled to body height.
- Preserves BT.709 color tags and limits preview MP4 to < 3 MB.

Usage:
  python render.py --clip <path.mp4> --landmarks <path.json> --measures <path.json|none> --out <path.mp4>
"""

import argparse
import bisect
import json
import math
import os
import subprocess
import sys
import tempfile
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ─── Allowed Skeleton Topology (12 major body joints + nose) ───
ALLOWED_JOINTS = {0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28}

BONES = [
    # Torso
    (11, 12), (11, 23), (12, 24), (23, 24),
    # Left Arm
    (11, 13), (13, 15),
    # Right Arm
    (12, 14), (14, 16),
    # Left Leg
    (23, 25), (25, 27),
    # Right Leg
    (24, 26), (26, 28),
]

VISIBILITY_FLOOR = 0.50

# Visual Palette (WorkoutVision Design System)
COLOR_BONE = (240, 242, 245)       # Soft off-white
COLOR_JOINT = (56, 189, 248)       # Light cyan accent
COLOR_HIGHLIGHT = (234, 179, 8)    # Amber/Gold marker
COLOR_PANEL_BG = (12, 14, 18, 224) # Semi-transparent dark (rgba 12, 14, 18, 0.88)
COLOR_PANEL_RULE = (255, 255, 255, 36)
COLOR_FG = (244, 244, 245)
COLOR_MUTED = (148, 163, 184)
COLOR_WARN = (234, 179, 8)


def find_system_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Find a clean sans-serif system font (SF Pro, Helvetica, Menlo, Arial) or fallback."""
    candidates = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    if bold:
        candidates = [
            "/System/Library/Fonts/SFNSBold.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Supplemental/Helvetica-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ] + candidates

    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    """Wrap text to fit within max_width pixels."""
    words = text.split()
    if not words:
        return [""]

    lines = []
    current_line = []

    for word in words:
        test_line = " ".join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        line_w = bbox[2] - bbox[0]
        if line_w <= max_width or not current_line:
            current_line.append(word)
        else:
            lines.append(" ".join(current_line))
            current_line = [word]

    if current_line:
        lines.append(" ".join(current_line))

    return lines


def fit_text_lines(
    text: str,
    base_size: int,
    bold: bool,
    max_width: int,
    max_lines: int,
    draw: ImageDraw.ImageDraw
) -> tuple[ImageFont.ImageFont, list[str]]:
    """Shrink font size until text fits into at most max_lines within max_width."""
    size = base_size
    min_size = max(int(base_size * 0.65), 10)

    while size >= min_size:
        font = find_system_font(size, bold=bold)
        lines = wrap_text(text, font, max_width, draw)
        if len(lines) <= max_lines:
            # Verify no individual line overflows
            overflow = False
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                if (bbox[2] - bbox[0]) > max_width:
                    overflow = True
                    break
            if not overflow:
                return font, lines
        size -= 1

    font = find_system_font(min_size, bold=bold)
    return font, wrap_text(text, font, max_width, draw)


def resolve_active_measures(measures_data: dict | None, t_ms: int) -> tuple[list[dict], set[int]]:
    """Resolve active measurement item states and joints to highlight for timestamp t_ms."""
    if not measures_data:
        return [], set()

    items = measures_data.get("items", [])
    active_states = []
    active_highlight_joints = set()

    for item in items:
        key = item.get("key", "")
        label = item.get("label", "")
        unit = item.get("unit", "")
        decimals = item.get("decimals", 0)
        joints = item.get("joint", [])
        frames = item.get("frames", [])

        state = {
            "key": key,
            "label": label,
            "unit": unit,
            "decimals": decimals,
            "joints": joints,
            "active": False,
            "value_str": "—",
            "is_refusal": False,
        }

        if frames:
            sorted_frames = sorted(frames, key=lambda f: f.get("t_ms", 0))
            first_t = sorted_frames[0].get("t_ms", 0)

            # Show nothing before the first frame's t_ms
            if t_ms >= first_t:
                latest_idx = -1
                for i, f in enumerate(sorted_frames):
                    if f.get("t_ms", 0) <= t_ms:
                        latest_idx = i
                    else:
                        break

                if latest_idx >= 0:
                    f = sorted_frames[latest_idx]
                    is_active = False

                    if "until_ms" in f:
                        until = f.get("until_ms")
                        if until is None:
                            # explicitly null -> holds indefinitely
                            is_active = True
                        elif t_ms < until:
                            is_active = True
                        else:
                            is_active = False
                    else:
                        if latest_idx + 1 < len(sorted_frames):
                            next_t = sorted_frames[latest_idx + 1].get("t_ms", 0)
                            is_active = (t_ms < next_t)
                        else:
                            # Last frame with no until_ms
                            # Does not hold indefinitely: lasts for previous step delta or 1000ms
                            if latest_idx > 0:
                                delta = f.get("t_ms", 0) - sorted_frames[latest_idx - 1].get("t_ms", 0)
                            else:
                                delta = 1000
                            is_active = (t_ms < f.get("t_ms", 0) + delta)

                    if is_active:
                        refused = f.get("refused")
                        has_refusal = bool(refused and isinstance(refused, str) and len(refused.strip()) > 0)

                        if has_refusal:
                            state["active"] = True
                            state["is_refusal"] = True
                            state["value_str"] = refused.strip() # Preserve exact casing
                            for j in joints:
                                active_highlight_joints.add(j)
                        else:
                            val = f.get("value")
                            if val is not None:
                                state["active"] = True
                                margin = f.get("margin")
                                if decimals > 0:
                                    v_str = f"{float(val):.{decimals}f}"
                                else:
                                    v_str = f"{int(round(val))}" if isinstance(val, (int, float)) else str(val)

                                if margin is not None:
                                    if decimals > 0:
                                        m_str = f"{float(margin):.{decimals}f}"
                                    else:
                                        m_str = f"{int(round(margin))}" if isinstance(margin, (int, float)) else str(margin)
                                    val_unit = f"{v_str} ± {m_str} {unit}".strip()
                                else:
                                    val_unit = f"{v_str} {unit}".strip()

                                state["value_str"] = val_unit
                                for j in joints:
                                    active_highlight_joints.add(j)

        active_states.append(state)

    return active_states, active_highlight_joints


def draw_skeleton(
    overlay_bgr: np.ndarray,
    overlay_alpha: np.ndarray,
    frame_landmarks: list | None,
    active_highlight_joints: set[int],
    width: int,
    height: int
):
    """Draw 12 major joints + nose with antialiased OpenCV primitives scaled to body height."""
    if not frame_landmarks or len(frame_landmarks) < 13:
        return

    pts = {}
    for idx in ALLOWED_JOINTS:
        if idx < len(frame_landmarks):
            lm = frame_landmarks[idx]
            vis = lm[3] if len(lm) > 3 else 1.0
            if vis >= VISIBILITY_FLOOR:
                px = int(round(lm[0] * width))
                py = int(round(lm[1] * height))
                pts[idx] = (px, py, vis)

    if not pts:
        return

    # Dynamic scaling based on body bounding box height
    y_coords = [p[1] for p in pts.values()]
    body_h = max(y_coords) - min(y_coords) if len(y_coords) >= 2 else int(height * 0.4)
    body_h = max(body_h, 60)

    bone_w = max(int(round(0.006 * body_h)), 2)
    joint_r = max(int(round(0.010 * body_h)), 3)
    hl_r = max(int(round(0.016 * body_h)), 5)

    # 1. Draw Bones
    bone_bgr = (COLOR_BONE[2], COLOR_BONE[1], COLOR_BONE[0])
    for u, v in BONES:
        if u in pts and v in pts:
            pt1 = (pts[u][0], pts[u][1])
            pt2 = (pts[v][0], pts[v][1])
            cv2.line(overlay_bgr, pt1, pt2, bone_bgr, thickness=bone_w, lineType=cv2.LINE_AA)
            cv2.line(overlay_alpha, pt1, pt2, 220, thickness=bone_w, lineType=cv2.LINE_AA)

    # Connect nose (0) to shoulder center if available
    if 0 in pts and 11 in pts and 12 in pts:
        pt_nose = (pts[0][0], pts[0][1])
        pt_mid = ((pts[11][0] + pts[12][0]) // 2, (pts[11][1] + pts[12][1]) // 2)
        cv2.line(overlay_bgr, pt_nose, pt_mid, bone_bgr, thickness=bone_w, lineType=cv2.LINE_AA)
        cv2.line(overlay_alpha, pt_nose, pt_mid, 220, thickness=bone_w, lineType=cv2.LINE_AA)

    # 2. Draw Joints
    joint_bgr = (COLOR_JOINT[2], COLOR_JOINT[1], COLOR_JOINT[0])
    hl_bgr = (COLOR_HIGHLIGHT[2], COLOR_HIGHLIGHT[1], COLOR_HIGHLIGHT[0])

    for idx, (px, py, vis) in pts.items():
        center = (px, py)
        if idx in active_highlight_joints:
            # Highlighted joint
            cv2.circle(overlay_bgr, center, hl_r + 2, hl_bgr, thickness=2, lineType=cv2.LINE_AA)
            cv2.circle(overlay_alpha, center, hl_r + 2, 255, thickness=2, lineType=cv2.LINE_AA)
            cv2.circle(overlay_bgr, center, hl_r - 1, hl_bgr, thickness=-1, lineType=cv2.LINE_AA)
            cv2.circle(overlay_alpha, center, hl_r - 1, 255, thickness=-1, lineType=cv2.LINE_AA)
        else:
            # Regular joint
            cv2.circle(overlay_bgr, center, joint_r, joint_bgr, thickness=-1, lineType=cv2.LINE_AA)
            cv2.circle(overlay_alpha, center, joint_r, 255, thickness=-1, lineType=cv2.LINE_AA)


def render_measures_card(
    draw: ImageDraw.ImageDraw,
    measures_data: dict,
    active_states: list[dict],
    width: int,
    height: int
) -> int:
    """Render semi-transparent measures card with dynamic wrapping and shrink-to-fit."""
    scale = width / 480.0
    pad_x = int(round(16 * scale))
    pad_y = int(round(12 * scale))

    # Base typography (at 480px: labels >= 14px, values >= 20px)
    font_badge = find_system_font(max(int(round(11 * scale)), 10), bold=True)
    font_title = find_system_font(max(int(round(16 * scale)), 14), bold=True)
    font_sub = find_system_font(max(int(round(13 * scale)), 11), bold=False)
    font_caption = find_system_font(max(int(round(11 * scale)), 10), bold=False)

    base_label_size = max(int(round(14 * scale)), 14)
    base_val_size = max(int(round(20 * scale)), 20)
    base_refused_size = max(int(round(16 * scale)), 16)

    # 1. Calculate Layout Dimensions
    # Grid arrangement: max 2 columns per row if <= 4 items, 3 columns if 5+
    n_items = len(active_states)
    n_cols = 3 if n_items >= 5 else (2 if n_items >= 2 else 1)
    n_rows = math.ceil(n_items / n_cols) if n_items > 0 else 0

    col_gap = int(round(14 * scale))
    col_w = (width - 2 * pad_x - (n_cols - 1) * col_gap) // n_cols

    # Measure items
    prepared_items = []
    row_heights = [0] * n_rows

    for idx, state in enumerate(active_states):
        row_idx = idx // n_cols
        col_idx = idx % n_cols

        # Label lines
        lbl_font, lbl_lines = fit_text_lines(state["label"], base_label_size, False, col_w, 2, draw)
        lbl_h = len(lbl_lines) * (lbl_font.size + 2)

        # Value / Refusal lines
        val_str = state["value_str"]
        if state["is_refusal"]:
            val_font, val_lines = fit_text_lines(val_str, base_refused_size, True, col_w, 3, draw)
            val_color = COLOR_WARN + (255,)
        else:
            val_font, val_lines = fit_text_lines(val_str, base_val_size, True, col_w, 2, draw)
            val_color = (COLOR_FG + (255,)) if state["active"] else (COLOR_MUTED + (200,))

        val_h = len(val_lines) * (val_font.size + 4)
        total_item_h = lbl_h + 4 + val_h

        row_heights[row_idx] = max(row_heights[row_idx], total_item_h)

        prepared_items.append({
            "col_idx": col_idx,
            "row_idx": row_idx,
            "lbl_font": lbl_font,
            "lbl_lines": lbl_lines,
            "val_font": val_font,
            "val_lines": val_lines,
            "val_color": val_color,
        })

    # Header height
    badge = measures_data.get("badge")
    title = measures_data.get("title", "")
    subtitle = measures_data.get("subtitle", "")
    caption = measures_data.get("caption")

    header_h = 0
    if badge or title:
        header_h = int(round(26 * scale))

    caption_h = 0
    if caption:
        caption_h = int(round(20 * scale))

    row_gap = int(round(10 * scale))
    items_total_h = sum(row_heights) + max(n_rows - 1, 0) * row_gap

    panel_h = pad_y * 2 + header_h + (int(round(8 * scale)) if header_h else 0) + items_total_h + (int(round(8 * scale)) if caption_h else 0) + caption_h
    panel_y0 = height - panel_h

    # 2. Draw Background and Rule
    draw.rectangle([0, panel_y0, width, height], fill=COLOR_PANEL_BG)
    draw.line([(0, panel_y0), (width, panel_y0)], fill=COLOR_PANEL_RULE, width=1)

    curr_y = panel_y0 + pad_y

    # 3. Draw Header
    if badge or title:
        hx = pad_x
        if badge:
            badge_text = str(badge).upper()
            bbox = draw.textbbox((0, 0), badge_text, font=font_badge)
            bw = bbox[2] - bbox[0] + 12
            bh = bbox[3] - bbox[1] + 6
            draw.rounded_rectangle([hx, curr_y, hx + bw, curr_y + bh], radius=4, outline=COLOR_WARN + (200,), width=1)
            draw.text((hx + 6, curr_y + 2), badge_text, fill=COLOR_WARN + (255,), font=font_badge)
            hx += bw + 8

        if title:
            draw.text((hx, curr_y), title, fill=COLOR_FG + (255,), font=font_title)
            if subtitle:
                bbox_t = draw.textbbox((0, 0), title, font=font_title)
                draw.text((hx + (bbox_t[2] - bbox_t[0]) + 10, curr_y + 2), subtitle, fill=COLOR_MUTED + (255,), font=font_sub)

        curr_y += header_h + int(round(8 * scale))

    # 4. Draw Items Grid
    row_starts_y = []
    ry = curr_y
    for rh in row_heights:
        row_starts_y.append(ry)
        ry += rh + row_gap

    for item in prepared_items:
        ix = pad_x + item["col_idx"] * (col_w + col_gap)
        iy = row_starts_y[item["row_idx"]]

        # Draw Label lines
        for line in item["lbl_lines"]:
            draw.text((ix, iy), line, fill=COLOR_MUTED + (255,), font=item["lbl_font"])
            iy += item["lbl_font"].size + 2

        iy += 3

        # Draw Value / Refusal lines
        for line in item["val_lines"]:
            draw.text((ix, iy), line, fill=item["val_color"], font=item["val_font"])
            iy += item["val_font"].size + 4

    # 5. Draw Caption
    if caption:
        cap_y = panel_y0 + panel_h - pad_y - caption_h + int(round(4 * scale))
        draw.text((pad_x, cap_y), caption, fill=COLOR_MUTED + (190,), font=font_caption)

    return panel_h


def render_video(clip_path: str, landmarks_path: str, measures_path: str | None, out_path: str):
    if not os.path.exists(clip_path):
        raise FileNotFoundError(f"Clip not found: {clip_path}")

    if not os.path.exists(landmarks_path):
        raise FileNotFoundError(f"Landmarks not found: {landmarks_path}")

    measures_data = None
    if measures_path and measures_path.lower() != "none":
        if not os.path.exists(measures_path):
            raise FileNotFoundError(f"Measures file not found: {measures_path}")
        with open(measures_path, "r", encoding="utf-8") as f:
            measures_data = json.load(f)

    with open(landmarks_path, "r", encoding="utf-8") as f:
        landmarks_data = json.load(f)

    lms_frames = landmarks_data.get("frames", [])
    lms_t_list = [entry.get("t_ms", 0) for entry in lms_frames]

    cap = cv2.VideoCapture(clip_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {clip_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Rendering: {width}x{height} @ {fps:.2f} fps ({total_frames} frames)")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_avi = os.path.join(tmpdir, "rendered_raw.avi")
        fourcc = cv2.VideoWriter_fourcc(*"MJPG")
        writer = cv2.VideoWriter(tmp_avi, fourcc, fps, (width, height))

        frame_idx = 0
        while True:
            ret, frame_bgr = cap.read()
            if not ret:
                break

            t_ms = int(round(frame_idx * (1000.0 / fps)))

            # Nearest t_ms landmark lookup
            frame_lms = None
            if lms_t_list:
                pos = bisect.bisect_left(lms_t_list, t_ms)
                best_idx = None
                best_dist = float("inf")
                for candidate in (pos - 1, pos, pos + 1):
                    if 0 <= candidate < len(lms_t_list):
                        dist = abs(lms_t_list[candidate] - t_ms)
                        if dist < best_dist:
                            best_dist = dist
                            best_idx = candidate
                if best_idx is not None and best_dist <= 150:
                    frame_lms = lms_frames[best_idx].get("landmarks")

            # Resolve measures state for current timestamp
            active_states, active_hl_joints = resolve_active_measures(measures_data, t_ms)

            # Draw Antialiased Skeleton directly on frame
            overlay_bgr = np.zeros_like(frame_bgr)
            overlay_alpha = np.zeros((height, width), dtype=np.uint8)

            draw_skeleton(overlay_bgr, overlay_alpha, frame_lms, active_hl_joints, width, height)

            # Alpha blend skeleton
            alpha = (overlay_alpha.astype(np.float32) / 255.0)[:, :, np.newaxis]
            frame_bgr = ((1.0 - alpha) * frame_bgr + alpha * overlay_bgr).astype(np.uint8)

            # Draw Measures Card via Pillow overlay
            if measures_data:
                overlay_pil = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                draw_pil = ImageDraw.Draw(overlay_pil)
                render_measures_card(draw_pil, measures_data, active_states, width, height)

                overlay_np = np.array(overlay_pil)
                card_alpha = (overlay_np[:, :, 3].astype(np.float32) / 255.0)[:, :, np.newaxis]
                card_bgr = overlay_np[:, :, [2, 1, 0]]
                frame_bgr = ((1.0 - card_alpha) * frame_bgr + card_alpha * card_bgr).astype(np.uint8)

            writer.write(frame_bgr)
            frame_idx += 1

        cap.release()
        writer.release()

        # Transcode via ffmpeg with strict BT.709 tags and < 3 MB size target
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-i", tmp_avi,
            "-c:v", "libx264",
            "-crf", "22",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-color_primaries", "bt709",
            "-color_trc", "bt709",
            "-colorspace", "bt709",
            "-movflags", "+faststart",
            out_path
        ]
        proc = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg failed with exit code {proc.returncode}:\n{proc.stderr}")

        # Check file size: if exceeds 3 MB, compress with crf 26
        size_mb = os.path.getsize(out_path) / (1024 * 1024)
        if size_mb > 3.0:
            ffmpeg_cmd2 = [
                "ffmpeg", "-y",
                "-i", tmp_avi,
                "-c:v", "libx264",
                "-crf", "26",
                "-preset", "fast",
                "-pix_fmt", "yuv420p",
                "-color_primaries", "bt709",
                "-color_trc", "bt709",
                "-colorspace", "bt709",
                "-movflags", "+faststart",
                out_path
            ]
            subprocess.run(ffmpeg_cmd2, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
            size_mb = os.path.getsize(out_path) / (1024 * 1024)

    print(f"Successfully generated {out_path} ({size_mb:.2f} MB, {frame_idx} frames)")


def main():
    parser = argparse.ArgumentParser(description="Render WorkoutVision biomechanical demo videos.")
    parser.add_argument("--clip", required=True, help="Path to input source MP4 video.")
    parser.add_argument("--landmarks", required=True, help="Path to MediaPipe pose landmarks JSON file.")
    parser.add_argument("--measures", required=True, help="Path to measures JSON file or 'none'.")
    parser.add_argument("--out", required=True, help="Path to output rendered MP4 video.")
    args = parser.parse_args()

    render_video(args.clip, args.landmarks, args.measures, args.out)


if __name__ == "__main__":
    main()
