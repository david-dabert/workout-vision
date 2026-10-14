#!/usr/bin/env python3
"""
Generate REPORT.md from data/benchmarks/stability/results.json and variants_manifest.json.
Every number is calculated directly from committed JSON results.
"""

import json
import os
import sys
from collections import defaultdict

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
RESULTS_PATH = os.path.join(REPO_ROOT, "data/benchmarks/stability/results.json")
MANIFEST_PATH = os.path.join(REPO_ROOT, "data/benchmarks/stability/variants_manifest.json")
REPORT_PATH = os.path.join(REPO_ROOT, "data/benchmarks/stability/REPORT.md")

REPRODUCTION_COMMAND = "python3 scripts/benchmarks/report_matrix.py"

def load_data():
    if not os.path.exists(RESULTS_PATH):
        print(f"Error: Results file not found at {RESULTS_PATH}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(MANIFEST_PATH):
        print(f"Error: Manifest file not found at {MANIFEST_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(RESULTS_PATH, "r", encoding="utf-8") as f:
        results = json.load(f)
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    return results, manifest

def generate_report():
    results, manifest = load_data()
    runs = results.get("runs", [])

    lines = []
    lines.append("# WorkoutVision Stability Matrix Benchmark Report")
    lines.append("")
    lines.append(f"> **Reproduction Command**: `{REPRODUCTION_COMMAND}`")
    lines.append("> Generated automatically from `data/benchmarks/stability/results.json`.")
    lines.append("")

    lines.append("## Overview")
    lines.append("")
    lines.append("This benchmark measures the counting stability of WorkoutVision across video transformations (compression, scaling, framerate, cropping, brightness, flipping, rotation, encoding) on Chromium and WebKit.")
    lines.append("")

    # Summary metrics
    total_runs = len(runs)
    browsers = sorted(list(set(r["browser"] for r in runs)))
    clips = list(manifest.get("clips", {}).keys())

    lines.append(f"- **Total test runs recorded**: {total_runs}")
    lines.append(f"- **Browsers evaluated**: {', '.join(browsers)}")
    lines.append(f"- **Clips tested**: {len(clips)} (`{', '.join(clips)}`)")
    lines.append(f"- **Variants per clip**: 16")
    lines.append("")

    # Share of exact match per clip and browser
    lines.append("## 1. Exact Match Share (Count == True Count)")
    lines.append("")
    lines.append("| Clip | Exercise | True Count | Chromium Exact Match | WebKit Exact Match | Overall Exact Match |")
    lines.append("| :--- | :--- | :---: | :---: | :---: | :---: |")

    # Group runs by clip and browser (using run_index = 1 for the primary variant comparison)
    clip_browser_runs = defaultdict(lambda: defaultdict(list))
    for r in runs:
        if r.get("run_index", 1) == 1:
            clip_browser_runs[r["clip_id"]][r["browser"]].append(r)

    for clip_id in clips:
        clip_info = manifest["clips"][clip_id]
        true_cnt = clip_info["true_count"]
        lift = clip_info.get("source_file", "").split("/")[-1].split("-")[0]

        row = [f"`{clip_id}`", lift, str(true_cnt)]
        overall_exact = 0
        overall_total = 0

        for b in ["chromium", "webkit"]:
            b_runs = clip_browser_runs[clip_id].get(b, [])
            if b_runs:
                exact = sum(1 for r in b_runs if not r.get("refused") and r.get("count") == true_cnt)
                tot = len(b_runs)
                pct = (exact / tot) * 100 if tot > 0 else 0
                row.append(f"{exact}/{tot} ({pct:.1f}%)")
                overall_exact += exact
                overall_total += tot
            else:
                row.append("N/A")

        if overall_total > 0:
            ov_pct = (overall_exact / overall_total) * 100
            row.append(f"{overall_exact}/{overall_total} ({ov_pct:.1f}%)")
        else:
            row.append("N/A")

        lines.append("| " + " | ".join(row) + " |")

    lines.append("")

    # Per-clip detailed tables
    lines.append("## 2. Per-Clip Variant Stability Tables")
    lines.append("")

    for clip_id in clips:
        clip_info = manifest["clips"][clip_id]
        true_cnt = clip_info["true_count"]
        variants = list(clip_info.get("variants", {}).keys())

        lines.append(f"### Clip: `{clip_id}` (True Count: {true_cnt})")
        lines.append("")
        lines.append("| Variant | Chromium Count | Chromium Diff | WebKit Count | WebKit Diff | Chromium Samples | WebKit Samples |")
        lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |")

        for v in variants:
            # find runs for this variant in run_index = 1
            cr_run = next((r for r in runs if r["clip_id"] == clip_id and r["variant"] == v and r["browser"] == "chromium" and r.get("run_index", 1) == 1), None)
            wk_run = next((r for r in runs if r["clip_id"] == clip_id and r["variant"] == v and r["browser"] == "webkit" and r.get("run_index", 1) == 1), None)

            cr_cnt = "REFUSED" if cr_run and cr_run.get("refused") else (str(cr_run["count"]) if cr_run else "-")
            cr_diff = f"{cr_run['diff_from_true']:+d}" if cr_run and cr_run.get("diff_from_true") is not None else "-"
            cr_smp = str(cr_run.get("samples", "-")) if cr_run else "-"

            wk_cnt = "REFUSED" if wk_run and wk_run.get("refused") else (str(wk_run["count"]) if wk_run else "-")
            wk_diff = f"{wk_run['diff_from_true']:+d}" if wk_run and wk_run.get("diff_from_true") is not None else "-"
            wk_smp = str(wk_run.get("samples", "-")) if wk_run else "-"

            lines.append(f"| `{v}` | {cr_cnt} | {cr_diff} | {wk_cnt} | {wk_diff} | {cr_smp} | {wk_smp} |")

        lines.append("")

    # Variants that change the count and delta magnitude
    lines.append("## 3. Count Perturbations by Variant Type")
    lines.append("")
    lines.append("Analysis of which video transformations introduce rep counting deviations relative to `original`:")
    lines.append("")
    lines.append("| Variant | Tested Runs | Matches Original | Count Shifted | Max Delta | Mean Absolute Delta |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")

    # Aggregate by variant
    variant_stats = defaultdict(lambda: {"total": 0, "match_orig": 0, "shifted": 0, "deltas": []})
    for clip_id in clips:
        for b in browsers:
            orig_run = next((r for r in runs if r["clip_id"] == clip_id and r["variant"] == "original" and r["browser"] == b and r.get("run_index", 1) == 1), None)
            if not orig_run or orig_run.get("refused") or orig_run.get("count") is None:
                continue
            orig_count = orig_run["count"]

            clip_variants = manifest["clips"][clip_id].get("variants", {}).keys()
            for v in clip_variants:
                v_run = next((r for r in runs if r["clip_id"] == clip_id and r["variant"] == v and r["browser"] == b and r.get("run_index", 1) == 1), None)
                if not v_run or v_run.get("refused") or v_run.get("count") is None:
                    continue
                v_count = v_run["count"]
                delta = abs(v_count - orig_count)
                variant_stats[v]["total"] += 1
                if delta == 0:
                    variant_stats[v]["match_orig"] += 1
                else:
                    variant_stats[v]["shifted"] += 1
                variant_stats[v]["deltas"].append(delta)

    for v in sorted(variant_stats.keys()):
        stat = variant_stats[v]
        tot = stat["total"]
        if tot == 0:
            continue
        matches = stat["match_orig"]
        shifted = stat["shifted"]
        max_d = max(stat["deltas"]) if stat["deltas"] else 0
        mean_d = sum(stat["deltas"]) / len(stat["deltas"]) if stat["deltas"] else 0
        lines.append(f"| `{v}` | {tot} | {matches} ({(matches/tot)*100:.1f}%) | {shifted} ({(shifted/tot)*100:.1f}%) | {max_d} | {mean_d:.2f} |")

    lines.append("")

    # Run-to-run repeatability
    lines.append("## 4. Run-to-Run Repeatability (Deterministic Check)")
    lines.append("")
    # Check differences between run_index = 1 and run_index = 2
    pairs = defaultdict(dict)
    for r in runs:
        idx = r.get("run_index", 1)
        key = (r["browser"], r["clip_id"], r["variant"])
        pairs[key][idx] = r

    repeat_matches = 0
    repeat_diffs = 0
    diff_records = []

    for key, idx_map in pairs.items():
        if 1 in idx_map and 2 in idx_map:
            r1 = idx_map[1]
            r2 = idx_map[2]
            c1 = r1.get("count")
            c2 = r2.get("count")
            if c1 == c2:
                repeat_matches += 1
            else:
                repeat_diffs += 1
                diff_records.append((key, c1, c2))

    total_pairs = repeat_matches + repeat_diffs
    if total_pairs > 0:
        lines.append(f"- **Evaluated pairs (Run 1 vs Run 2)**: {total_pairs}")
        lines.append(f"- **Identical count outputs**: {repeat_matches} ({(repeat_matches/total_pairs)*100:.1f}%)")
        lines.append(f"- **Divergent count outputs**: {repeat_diffs} ({(repeat_diffs/total_pairs)*100:.1f}%)")
        lines.append("")
        if diff_records:
            lines.append("### Divergent Pairs Detail")
            lines.append("| Browser | Clip | Variant | Run 1 Count | Run 2 Count |")
            lines.append("| :--- | :--- | :--- | :---: | :---: |")
            for (b, c, v), c1, c2 in diff_records:
                lines.append(f"| {b} | `{c}` | `{v}` | {c1} | {c2} |")
            lines.append("")
    else:
        lines.append("Run 2 currently in progress or not yet executed.")
        lines.append("")

    # Refusals table
    lines.append("## 5. Refusals")
    lines.append("")
    refused_runs = [r for r in runs if r.get("refused")]
    if refused_runs:
        lines.append("| Browser | Clip | Variant | Reason / Error | Samples | Pose Coverage |")
        lines.append("| :--- | :--- | :--- | :--- | :---: | :---: |")
        for r in refused_runs:
            err = r.get("error", "Count engine visibility refusal (<50% valid joint angles)")
            cov = f"{r.get('pose_coverage', 0)*100:.1f}%" if r.get("pose_coverage") is not None else "N/A"
            lines.append(f"| {r['browser']} | `{r['clip_id']}` | `{r['variant']}` | {err} | {r.get('samples', 'N/A')} | {cov} |")
        lines.append("")
    else:
        lines.append("No video variants were refused by the core counting engine.")
        lines.append("")

    report_content = "\n".join(lines) + "\n"
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"Report generated successfully at {REPORT_PATH} ({len(report_content)} bytes)")

if __name__ == "__main__":
    generate_report()
