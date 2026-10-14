#!/usr/bin/env python3
"""
Stability Matrix: Video Variant Generator

Generates re-encoded, resized, cropped, relit, and metadata variants of demo clips
to measure rep count stability across video variations.

Outputs:
- Video files saved to: ~/wv-tools/variants/<clip>/<variant>.mp4 (OUT OF GIT)
- Manifest saved to: data/benchmarks/stability/variants_manifest.json (COMMITTED)
"""

import os
import re
import sys
import json
import shutil
import hashlib
import subprocess
from pathlib import Path

ABOUT_COPY_PATH = "src/components/experience/about-copy.js"
DEMO_DIR = "public/demo"
VARIANTS_DIR = os.path.expanduser("~/wv-tools/variants")
OUTPUT_MANIFEST = "data/benchmarks/stability/variants_manifest.json"

def get_kept_counts(about_copy_file: str):
    """
    Dynamically extracts the true 'kept' counts from about-copy.js DEMOS block.
    """
    if not os.path.exists(about_copy_file):
        raise FileNotFoundError(f"Missing {about_copy_file}")
    with open(about_copy_file, "r", encoding="utf-8") as f:
        content = f.read()
    demos_match = re.search(r"export const DEMOS\s*=\s*\[(.*?)\];", content, re.DOTALL)
    if not demos_match:
        raise ValueError("Could not find DEMOS block in about-copy.js")
    demos_block = demos_match.group(1)
    items = re.findall(r"\{\s*file:\s*['\"]([^'\"]+)['\"].*?kept:\s*(\d+)", demos_block, re.DOTALL)
    kept_map = {item[0]: int(item[1]) for item in items}
    return kept_map

def get_video_meta(filepath: str):
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,duration",
        "-show_entries", "format=duration",
        "-of", "json",
        filepath
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    info = json.loads(res.stdout)
    stream = info["streams"][0]
    
    width = int(stream["width"])
    height = int(stream["height"])
    
    # Parse fps
    r_fps = stream.get("r_frame_rate", "30/1")
    if "/" in r_fps:
        num, den = r_fps.split("/")
        fps = round(float(num) / float(den), 2)
    else:
        fps = round(float(r_fps), 2)
        
    duration = float(stream.get("duration") or info.get("format", {}).get("duration", 0.0))
    
    return {
        "width": width,
        "height": height,
        "fps": fps,
        "duration": round(duration, 3)
    }

def get_file_sha256(filepath: str):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def define_variants(clip_name: str, input_path: str, out_clip_dir: str, in_meta: dict):
    """
    Returns dict of variant definitions with their output file and ffmpeg command.
    """
    variants = {}
    
    # 1. Original
    orig_out = os.path.join(out_clip_dir, "original.mp4")
    variants["original"] = {
        "command": ["cp", input_path, orig_out],
        "output": orig_out,
        "type": "copy"
    }

    # 2. H.264 at CRF 18, 28, 35
    for crf in [18, 28, 35]:
        out_f = os.path.join(out_clip_dir, f"crf{crf}.mp4")
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-c:v", "libx264", "-crf", str(crf), "-preset", "fast",
            "-an",
            out_f
        ]
        variants[f"crf{crf}"] = {"command": cmd, "output": out_f, "type": "ffmpeg"}

    # 3. Short side at 720, 480, 360 px
    for s in [720, 480, 360]:
        out_f = os.path.join(out_clip_dir, f"scale_{s}.mp4")
        scale_filter = f"scale=if(gt(iw\\,ih)\\,-2\\,{s}):if(gt(iw\\,ih)\\,{s}\\,-2)"
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-vf", scale_filter,
            "-c:v", "libx264", "-crf", "23", "-preset", "fast",
            "-an",
            out_f
        ]
        variants[f"scale_{s}"] = {"command": cmd, "output": out_f, "type": "ffmpeg"}

    # 4. Frame rate halved, fixed at 24 and 15 fps
    half_fps = round(in_meta["fps"] / 2.0, 2)
    fps_vars = [("fps_half", f"fps={half_fps}"), ("fps_24", "fps=24"), ("fps_15", "fps=15")]
    for var_id, filter_str in fps_vars:
        out_f = os.path.join(out_clip_dir, f"{var_id}.mp4")
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-vf", filter_str,
            "-c:v", "libx264", "-crf", "23", "-preset", "fast",
            "-an",
            out_f
        ]
        variants[var_id] = {"command": cmd, "output": out_f, "type": "ffmpeg"}

    # 5. 10 % crop on each side (visible width 80%, visible height 80%)
    out_f = os.path.join(out_clip_dir, "crop_10.mp4")
    crop_filter = "crop=trunc(0.8*in_w/2)*2:trunc(0.8*in_h/2)*2:trunc(0.1*in_w/2)*2:trunc(0.1*in_h/2)*2"
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", crop_filter,
        "-c:v", "libx264", "-crf", "23", "-preset", "fast",
        "-an",
        out_f
    ]
    variants["crop_10"] = {"command": cmd, "output": out_f, "type": "ffmpeg"}

    # 6. Brightness -20 % and +20 %
    for b_id, b_val in [("brightness_m20", "-0.20"), ("brightness_p20", "0.20")]:
        out_f = os.path.join(out_clip_dir, f"{b_id}.mp4")
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-vf", f"eq=brightness={b_val}",
            "-c:v", "libx264", "-crf", "23", "-preset", "fast",
            "-an",
            out_f
        ]
        variants[b_id] = {"command": cmd, "output": out_f, "type": "ffmpeg"}

    # 7. Horizontal flip
    out_f = os.path.join(out_clip_dir, "hflip.mp4")
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", "hflip",
        "-c:v", "libx264", "-crf", "23", "-preset", "fast",
        "-an",
        out_f
    ]
    variants["hflip"] = {"command": cmd, "output": out_f, "type": "ffmpeg"}

    # 8. Rotation metadata of 90 degrees (display matrix, pixels untouched)
    out_f = os.path.join(out_clip_dir, "rotate_90.mp4")
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-c", "copy",
        "-metadata:s:v:0", "rotate=90",
        out_f
    ]
    variants["rotate_90"] = {"command": cmd, "output": out_f, "type": "ffmpeg"}

    # 9. HEVC (hvc1 tag; WebKit only)
    out_f = os.path.join(out_clip_dir, "hevc.mp4")
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-c:v", "libx265", "-tag:v", "hvc1", "-crf", "23", "-preset", "fast",
        "-an",
        out_f
    ]
    variants["hevc"] = {"command": cmd, "output": out_f, "type": "ffmpeg"}

    return variants

def main():
    print(f"Reading kept counts from {ABOUT_COPY_PATH}...")
    kept_counts = get_kept_counts(ABOUT_COPY_PATH)
    print(f"Extracted {len(kept_counts)} kept counts: {kept_counts}")

    os.makedirs(VARIANTS_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(OUTPUT_MANIFEST), exist_ok=True)

    manifest = {
        "description": "Stability Matrix Video Variants Manifest",
        "variants_directory": VARIANTS_DIR,
        "clips": {}
    }

    for clip_name, true_count in kept_counts.items():
        input_mp4 = os.path.join(DEMO_DIR, f"{clip_name}.mp4")
        if not os.path.exists(input_mp4):
            print(f"Warning: Demo clip {input_mp4} not found, skipping.")
            continue

        in_meta = get_video_meta(input_mp4)
        print(f"\nProcessing clip: {clip_name} (true count: {true_count}, {in_meta['width']}x{in_meta['height']} @ {in_meta['fps']} fps)")
        out_clip_dir = os.path.join(VARIANTS_DIR, clip_name)
        os.makedirs(out_clip_dir, exist_ok=True)

        clip_vars = define_variants(clip_name, input_mp4, out_clip_dir, in_meta)
        manifest["clips"][clip_name] = {
            "source_file": input_mp4,
            "true_count": true_count,
            "source_meta": in_meta,
            "variants": {}
        }

        for var_name, var_info in clip_vars.items():
            out_file = var_info["output"]
            cmd = var_info["command"]
            print(f"  Generating {var_name}...")
            
            if var_info["type"] == "copy":
                shutil.copyfile(var_info["command"][1], out_file)
            else:
                subprocess.run(cmd, capture_output=True, check=True)

            meta = get_video_meta(out_file)
            file_sha = get_file_sha256(out_file)

            manifest["clips"][clip_name]["variants"][var_name] = {
                "file_path": out_file,
                "command": " ".join(cmd),
                "sha256": file_sha,
                "width": meta["width"],
                "height": meta["height"],
                "fps": meta["fps"],
                "duration": meta["duration"]
            }

    with open(OUTPUT_MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    total_variants = sum(len(c["variants"]) for c in manifest["clips"].values())
    print(f"\nCompleted! Generated {total_variants} video variants across {len(manifest['clips'])} clips.")
    print(f"Manifest written to: {OUTPUT_MANIFEST}")

if __name__ == "__main__":
    main()
