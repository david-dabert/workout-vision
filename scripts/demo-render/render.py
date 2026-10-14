#!/usr/bin/env python3
"""
WorkoutVision Demo Video Renderer

Draws genuine offline MediaPipe Pose skeletons locked directly to athlete joints
and optional measurement cards from Claude's measures JSON specification.

Usage:
  python render.py --clip <path.mp4> --landmarks <path.json> --measures <path.json|none> --out <path.mp4>
"""

import argparse
import json
import os
import sys
import tempfile
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ─── MediaPipe Pose Landmark Skeleton Topology (33 landmarks) ───

CONNECTIONS = [
    # Torso
    (11, 12), (11, 23), (12, 24), (23, 24),
    # Left Arm
    (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),
    # Right Arm
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    # Left Leg
    (23, 25), (25, 27), (27, 29), (27, 31), (29, 31),
    # Right Leg
    (24, 26), (26, 28), (28, 30), (28, 32), (30, 32),
    # Head / Face
    (0, 1), (1, 2), (2, 3), (3, 7),
    (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10)
]

VISIBILITY_FLOOR = 0.50

# Visual Palette (matching WorkoutVision design system)
COLOR_BONE = (240, 242, 245)       # Soft off-white
COLOR_JOINT = (56, 189, 248)       # Light cyan accent
COLOR_HIGHLIGHT = (234, 179, 8)    # Amber/Gold marker
COLOR_PANEL_BG = (12, 14, 18, 224) # Semi-transparent dark
COLOR_PANEL_RULE = (255, 255, 255, 36)
COLOR_FG = (244, 244, 245)
COLOR_MUTED = (148, 163, 184)
COLOR_WARN = (234, 179, 8)


def find_system_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Find a clean sans-serif system font (SF Pro, Helvetica, DejaVu, Arial) or fallback."""
    candidates = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
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


def render_frame(
    frame_bgr: np.ndarray,
    frame_landmarks: list | None,
    measures_data: dict | None,
    t_ms: int,
    width: int,
    height: int,
    fonts: dict
) -> np.ndarray:
    """Render skeleton and measures onto a single video frame."""
    out_bgr = frame_bgr.copy()
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    active_highlight_joints = set()
    current_items_state = []

    # 1. Resolve Measures state for current timestamp (if measures provided)
    if measures_data:
        items = measures_data.get("items", [])
        for item in items:
            key = item.get("key", "")
            label = item.get("label", "")
            unit = item.get("unit", "")
            joints = item.get("joint", [])
            frames = item.get("frames", [])

            # Find closest frame by t_ms
            best_f = None
            if frames:
                best_f = min(frames, key=lambda f: abs(f.get("t_ms", 0) - t_ms))

            if best_f:
                val = best_f.get("value")
                margin = best_f.get("margin")
                refused = best_f.get("refused")
                current_items_state.append({
                    "label": label,
                    "unit": unit,
                    "value": val,
                    "margin": margin,
                    "refused": refused
                })
                # Add joints to highlight set
                for j in joints:
                    active_highlight_joints.add(j)

    # 2. Draw Skeleton Joints and Bones
    if frame_landmarks and len(frame_landmarks) >= 33:
        # Landmarks: [[x, y, z, visibility, presence] x 33]
        pts = {}
        for idx, lm in enumerate(frame_landmarks):
            vis = lm[3] if len(lm) > 3 else 1.0
            if vis >= VISIBILITY_FLOOR:
                px = int(lm[0] * width)
                py = int(lm[1] * height)
                pts[idx] = (px, py, vis)

        # Draw bones (only where BOTH ends are visible >= 0.5)
        for u, v in CONNECTIONS:
            if u in pts and v in pts:
                draw.line([pts[u][:2], pts[v][:2]], fill=COLOR_BONE + (220,), width=2)

        # Draw joints
        for idx, (px, py, vis) in pts.items():
            if idx in active_highlight_joints:
                # Highlighted joint from measures specification
                draw.ellipse([px - 5, py - 5, px + 5, py + 5], outline=COLOR_HIGHLIGHT + (255,), width=2)
                draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=COLOR_HIGHLIGHT + (255,))
            else:
                draw.ellipse([px - 3, py - 3, px + 3, py + 3], fill=COLOR_JOINT + (255,))

    # 3. Draw Measures Panel at bottom (if provided)
    if measures_data and (current_items_state or measures_data.get("title")):
        panel_h = 130
        panel_y0 = height - panel_h
        draw.rectangle([0, panel_y0, width, height], fill=COLOR_PANEL_BG)
        draw.line([(0, panel_y0), (width, panel_y0)], fill=COLOR_PANEL_RULE, width=1)

        # Header: Badge + Title + Subtitle
        pad_x = 16
        curr_y = panel_y0 + 10

        badge = measures_data.get("badge")
        title = measures_data.get("title", "")
        subtitle = measures_data.get("subtitle", "")

        header_x = pad_x
        if badge:
            # Draw badge pill
            badge_text = str(badge).upper()
            bbox = draw.textbbox((0, 0), badge_text, font=fonts['badge'])
            bw = bbox[2] - bbox[0] + 12
            bh = bbox[3] - bbox[1] + 6
            draw.rounded_rectangle([header_x, curr_y, header_x + bw, curr_y + bh], radius=4, outline=COLOR_WARN + (200,), width=1)
            draw.text((header_x + 6, curr_y + 2), badge_text, fill=COLOR_WARN + (255,), font=fonts['badge'])
            header_x += bw + 8

        if title:
            draw.text((header_x, curr_y), title, fill=COLOR_FG + (255,), font=fonts['title'])
            if subtitle:
                bbox_t = draw.textbbox((0, 0), title, font=fonts['title'])
                draw.text((header_x + (bbox_t[2] - bbox_t[0]) + 10, curr_y + 2), subtitle, fill=COLOR_MUTED + (255,), font=fonts['sub'])

        # Items Grid / Row
        item_y = curr_y + 28
        item_spacing = max(width // max(len(current_items_state), 1), 120)

        for i, item in enumerate(current_items_state):
            ix = pad_x + i * item_spacing
            lbl = item["label"]
            draw.text((ix, item_y), lbl.upper(), fill=COLOR_MUTED + (255,), font=fonts['label'])

            # Value string rule:
            # - if value is null and refused is a string: refused
            # - always draw value as "value ± margin unit"
            if item["value"] is None and item["refused"]:
                val_str = str(item["refused"])
                val_color = COLOR_WARN + (255,)
            elif item["value"] is not None:
                v = item["value"]
                m = item.get("margin")
                u = item.get("unit", "")
                if m is not None:
                    val_str = f"{v} ± {m} {u}".strip()
                else:
                    val_str = f"{v} {u}".strip()
                val_color = COLOR_FG + (255,)
            else:
                val_str = "—"
                val_color = COLOR_MUTED + (255,)

            draw.text((ix, item_y + 16), val_str, fill=val_color, font=fonts['val'])

        # Caption
        caption = measures_data.get("caption")
        if caption:
            draw.text((pad_x, panel_y0 + panel_h - 22), caption, fill=COLOR_MUTED + (200,), font=fonts['caption'])

    # Composite Pillow overlay onto OpenCV frame
    overlay_np = np.array(overlay)
    alpha = overlay_np[:, :, 3] / 255.0
    for c in range(3):
        out_bgr[:, :, c] = (1.0 - alpha) * out_bgr[:, :, c] + alpha * overlay_np[:, :, 2 - c]

    return out_bgr


def main():
    parser = argparse.ArgumentParser(description="Render WorkoutVision biomechanical demo videos.")
    parser.add_argument("--clip", required=True, help="Path to input source MP4 video.")
    parser.add_argument("--landmarks", required=True, help="Path to MediaPipe pose landmarks JSON file.")
    parser.add_argument("--measures", required=True, help="Path to measures JSON file or 'none'.")
    parser.add_argument("--out", required=True, help="Path to output rendered MP4 video.")
    args = parser.parse_args()

    if not os.path.exists(args.clip):
        print(f"Error: Clip file not found: {args.clip}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(args.landmarks):
        print(f"Error: Landmarks file not found: {args.landmarks}", file=sys.stderr)
        sys.exit(1)

    measures_data = None
    if args.measures.lower() != "none":
        if not os.path.exists(args.measures):
            print(f"Error: Measures file not found: {args.measures}", file=sys.stderr)
            sys.exit(1)
        with open(args.measures, "r") as f:
            measures_data = json.load(f)

    with open(args.landmarks, "r") as f:
        landmarks_data = json.load(f)

    lms_frames = landmarks_data.get("frames", [])
    print(f"Loaded {len(lms_frames)} landmark frames from {args.landmarks}")

    cap = cv2.VideoCapture(args.clip)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Video input: {width}x{height} @ {fps:.2f} fps ({total_frames} frames)")

    fonts = {
        'badge': find_system_font(10, bold=True),
        'title': find_system_font(14, bold=True),
        'sub': find_system_font(12, bold=False),
        'label': find_system_font(10, bold=False),
        'val': find_system_font(15, bold=True),
        'caption': find_system_font(10, bold=False),
    }

    # Temporary output for OpenCV writer before transcode
    tmp_out = tempfile.mktemp(suffix=".mp4")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(tmp_out, fourcc, fps, (width, height))

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        t_ms = int(frame_idx * (1000.0 / fps))
        lm_entry = lms_frames[frame_idx] if frame_idx < len(lms_frames) else None
        lms = lm_entry.get("landmarks") if lm_entry else None

        rendered = render_frame(frame, lms, measures_data, t_ms, width, height, fonts)
        writer.write(rendered)
        frame_idx += 1

    cap.release()
    writer.release()

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    # Transcode to H.264 yuv420p faststart
    cmd = f"ffmpeg -y -i {tmp_out} -c:v libx264 -pix_fmt yuv420p -movflags +faststart {args.out} >/dev/null 2>&1"
    ret = os.system(cmd)
    if os.path.exists(tmp_out):
        os.remove(tmp_out)

    if ret != 0 or not os.path.exists(args.out):
        print(f"Error during ffmpeg transcode to {args.out}", file=sys.stderr)
        sys.exit(1)

    out_size_mb = os.path.getsize(args.out) / (1024 * 1024)
    print(f"Successfully rendered {args.out} ({out_size_mb:.2f} MB, {frame_idx} frames)")


if __name__ == "__main__":
    main()
