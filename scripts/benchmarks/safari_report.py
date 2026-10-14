#!/usr/bin/env python3
"""
scripts/benchmarks/safari_report.py

Generates data/benchmarks/safari/REPORT.md from benchmark results comparing
Safari (Run 1 and Run 2) vs Chromium on the evaluation videos.
"""

import json
import sys
from pathlib import Path

DEFAULT_RESULTS_PATH = Path.home() / "wv-tools" / "safari-readings" / "results.json"


def generate_report(results_file: Path):
    if not results_file.exists():
        print(f"Results file not found: {results_file}")
        return

    with open(results_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows = data.get("videos", [])
    exact_safari = sum(1 for r in rows if r.get("safari_exact", False))
    exact_chromium = sum(1 for r in rows if r.get("chromium_exact", False))
    disagreements = sum(1 for r in rows if r.get("safari_run1") != r.get("chromium_count"))

    headers = [
        "Lift",
        "David's Label",
        "Safari Run 1",
        "Safari Run 2",
        "Chromium",
        "Safari Time (s)",
        "Safari Exact",
    ]

    col_fmt = "| {:<20} | {:>13} | {:>12} | {:>12} | {:>10} | {:>15} | {:^12} |"
    sep_fmt = "|:" + "-" * 21 + "|" + "-" * 15 + ":|" + "-" * 14 + ":|" + "-" * 14 + ":|" + "-" * 12 + ":|" + "-" * 17 + ":|:" + "-" * 13 + ":|"

    table_lines = [
        col_fmt.format(*headers),
        sep_fmt,
    ]

    for r in rows:
        table_lines.append(
            col_fmt.format(
                r["lift"],
                r["label"],
                str(r.get("safari_run1", "-")),
                str(r.get("safari_run2", "-")),
                str(r.get("chromium_count", "-")),
                f"{r.get('safari_seconds', 0.0):.2f}",
                "Yes" if r.get("safari_exact") else "No",
            )
        )

    output = []
    output.append("# Safari vs Chromium Reading Benchmark\n")
    output.append("## Results\n")
    output.extend(table_lines)
    output.append("\n## Summary\n")
    output.append(f"- **Total Videos**: {len(rows)}")
    output.append(f"- **Exact in Safari**: {exact_safari} / {len(rows)}")
    output.append(f"- **Exact in Chromium**: {exact_chromium} / {len(rows)}")
    output.append(f"- **Browser Disagreements**: {disagreements} / {len(rows)}\n")

    report_text = "\n".join(output)
    print(report_text)


if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_RESULTS_PATH
    generate_report(path)
