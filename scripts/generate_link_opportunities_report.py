#!/usr/bin/env python3
import argparse
import csv
import textwrap
from pathlib import Path


def parse_int(value: str) -> int:
    try:
        return int(value.strip())
    except Exception:
        return 0


def parse_float(value: str) -> float:
    try:
        return float(value.strip())
    except Exception:
        return 0.0


def normalize_bool(value: str) -> str:
    return value.strip().lower()


def normalize_context(context: str, max_len: int = 240) -> str:
    cleaned = " ".join(context.split())
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 1] + "…"


def escape_md(value: str) -> str:
    return value.replace("|", "\\|")


def generate_report(input_path: Path, output_path: Path) -> None:
    with input_path.open(encoding="utf-16", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        rows = []
        for row in reader:
            source_canonical = normalize_bool(row.get("Source is canonical", ""))
            source_noindex = normalize_bool(row.get("Source is noindex", ""))
            if source_canonical != "true" or source_noindex != "false":
                continue

            source_page = row.get("Source page", "").strip()
            keyword = row.get("Keyword", "").strip()
            target_page = row.get("Target page", "").strip()
            if not source_page or not keyword or not target_page:
                continue

            row_data = {
                "source_page": source_page,
                "keyword": keyword,
                "target_page": target_page,
                "search_volume": parse_int(row.get("Keyword search volume", "")),
                "difficulty": parse_float(row.get("Keyword difficulty", "")),
                "target_position": parse_int(row.get("Target position", "")),
                "context": normalize_context(row.get("Keyword context", "")),
            }
            rows.append(row_data)

    deduped = {}
    for row in rows:
        key = (row["source_page"], row["keyword"], row["target_page"])
        if key not in deduped:
            deduped[key] = row

    sorted_rows = sorted(
        deduped.values(),
        key=lambda item: (-item["search_volume"], item["difficulty"], item["target_position"]),
    )

    header = [
        "# Internal Linking Opportunities",
        "",
        "Filtered to canonical, indexable sources. Sorted by search volume desc, difficulty asc, target position asc.",
        "",
        "| Source page | Keyword | Target page | Search volume | Difficulty | Target position | Context |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]

    lines = []
    for row in sorted_rows:
        lines.append(
            "| {source_page} | {keyword} | {target_page} | {search_volume} | {difficulty} | {target_position} | {context} |".format(
                source_page=escape_md(row["source_page"]),
                keyword=escape_md(row["keyword"]),
                target_page=escape_md(row["target_page"]),
                search_volume=row["search_volume"],
                difficulty=row["difficulty"],
                target_position=row["target_position"],
                context=escape_md(row["context"]),
            )
        )

    output_path.write_text("\n".join(header + lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a Markdown summary of internal linking opportunities."
    )
    parser.add_argument("input_csv", type=Path, help="Path to the UTF-16LE tab-delimited CSV.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("link-opportunities-summary.md"),
        help="Output Markdown file path.",
    )
    args = parser.parse_args()

    if not args.input_csv.exists():
        raise SystemExit(f"Input CSV not found: {args.input_csv}")

    generate_report(args.input_csv, args.output)


if __name__ == "__main__":
    main()
