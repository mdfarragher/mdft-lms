#!/usr/bin/env python3
"""
convert_quiz.py

Convert Hugo-format quiz question markdown files into a Directus-compatible CSV
import file, matching the schema of quiz_export_template.csv.

Usage:
    python convert_quiz.py --folder <path/to/quiz_questions> \
                           --slug-prefix <prefix> \
                           [--user-id <uuid>] \
                           [--output <output.csv>]

Arguments:
    --folder        Path to the folder containing markdown question files.
                    (default: quiz_questions)
    --slug-prefix   Prefix used when generating question slugs.
                    The question number from the filename is appended, e.g.
                    "ai900-ai-q" + "6" -> "ai900-ai-q6".
    --user-id       Directus user UUID to use for user_created and user_updated.
                    (default: e1f46fac-fe3b-4973-b935-8ebbfc667b0d)
    --output        Output CSV file path.
                    (default: quiz_output.csv in the same folder as this script)

Markdown format expected (Hugo front matter):
    ---
    title: "Question title"
    type: "question"
    layout: "single"
    answers:
        - id: answer1
          title: "Answer text"
          correct: true          # present only on the correct answer
          explain: "Explanation" # optional; absent means empty explanation

        - id: answer2
          title: "Another answer"
          explain: "Explanation"
    ---

    Question body text here.

CSV output columns (same as quiz_export_template.csv):
    id, status, sort, user_created, date_created, user_updated, date_updated,
    question_type, title, slug, content, answers
"""

import argparse
import csv
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML is required. Install it with: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_USER_ID = "e1f46fac-fe3b-4973-b935-8ebbfc667b0d"
STATUS = "draft"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def now_iso() -> str:
    """Return the current UTC time in ISO-8601 format (Directus-compatible)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def parse_markdown_file(filepath: Path) -> dict | None:
    """
    Parse a single Hugo-format markdown file.

    Returns a dict with keys:
        title, question_type, content, answers
    or None if the file should be skipped (e.g. not a question file).
    """
    text = filepath.read_text(encoding="utf-8")

    # Split front matter from body
    fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if not fm_match:
        return None

    front_matter_raw = fm_match.group(1)
    body = fm_match.group(2).strip()

    try:
        fm = yaml.safe_load(front_matter_raw)
    except yaml.YAMLError as exc:
        print(f"  WARNING: YAML parse error in {filepath.name}: {exc}", file=sys.stderr)
        return None

    if not isinstance(fm, dict):
        return None

    # Skip non-question files (e.g. results pages)
    if fm.get("type") not in ("question", "q"):
        return None
    if fm.get("layout") == "results":
        return None

    title = fm.get("title", "").strip().title()
    question_type = fm.get("layout", "single").strip()

    raw_answers = fm.get("answers", []) or []
    answers = []
    for ans in raw_answers:
        if not isinstance(ans, dict):
            continue
        answers.append(
            {
                "title": str(ans.get("title", "")).strip(),
                "correct": bool(ans.get("correct", False)),
                "explain": str(ans.get("explain", "")).strip(),
            }
        )

    return {
        "title": title,
        "question_type": question_type,
        "content": body,
        "answers": answers,
    }


def build_csv_row(
    question_number: int,
    slug_prefix: str,
    parsed: dict,
    created_at: str,
    user_id: str,
) -> dict:
    """
    Build a single CSV row dict from a parsed markdown question.
    """
    question_id = str(uuid.uuid4())
    slug = f"{slug_prefix}{question_number}"

    answer_rows = []
    for sort_num, ans in enumerate(parsed["answers"], start=1):
        answer_rows.append(
            {
                "id": str(uuid.uuid4()),
                "status": STATUS,
                "sort": sort_num,
                "user_created": user_id,
                "date_created": created_at,
                "user_updated": user_id,
                "date_updated": created_at,
                "is_correct": ans["correct"],
                "content": ans["title"],
                "explanation": ans["explain"],
                "question": question_id,
            }
        )

    return {
        "id": question_id,
        "status": STATUS,
        "sort": question_number,
        "user_created": user_id,
        "date_created": created_at,
        "user_updated": user_id,
        "date_updated": created_at,
        "question_type": parsed["question_type"],
        "title": parsed["title"],
        "slug": slug,
        "content": parsed["content"],
        "answers": json.dumps(answer_rows, ensure_ascii=False, separators=(",", ":")),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert Hugo quiz markdown files to a Directus-compatible CSV."
    )
    parser.add_argument(
        "--folder",
        default="quiz_questions",
        help="Path to the folder containing markdown question files (default: quiz_questions)",
    )
    parser.add_argument(
        "--slug-prefix",
        required=True,
        help="Slug prefix for questions, e.g. 'ai900-ai-q'. "
        "The number from the filename is appended to form the full slug.",
    )
    parser.add_argument(
        "--user-id",
        default=DEFAULT_USER_ID,
        help=f"Directus user UUID for user_created/user_updated fields "
        f"(default: {DEFAULT_USER_ID})",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output CSV file path (default: quiz_output.csv next to this script)",
    )
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"ERROR: Folder not found: {folder}", file=sys.stderr)
        sys.exit(1)

    output_path = (
        Path(args.output) if args.output else Path(__file__).parent / "quiz_output.csv"
    )

    # Collect all .md files whose name is a number, sorted numerically
    md_files: list[tuple[int, Path]] = []
    for filepath in folder.glob("*.md"):
        stem = filepath.stem
        if stem.isdigit():
            md_files.append((int(stem), filepath))
    md_files.sort(key=lambda t: t[0])

    if not md_files:
        print(f"No numbered markdown files found in {folder}", file=sys.stderr)
        sys.exit(1)

    created_at = now_iso()

    csv_fieldnames = [
        "id",
        "status",
        "sort",
        "user_created",
        "date_created",
        "user_updated",
        "date_updated",
        "question_type",
        "title",
        "slug",
        "content",
        "answers",
    ]

    rows: list[dict] = []
    for sort_index, (question_number, filepath) in enumerate(md_files, start=1):
        print(f"  Processing {filepath.name} ...", end=" ")
        parsed = parse_markdown_file(filepath)
        if parsed is None:
            print("skipped (not a question file)")
            continue
        row = build_csv_row(
            question_number,
            args.slug_prefix,
            parsed,
            created_at,
            args.user_id,
        )
        rows.append(row)
        print(
            f"ok  ->  slug={row['slug']}, sort={row['sort']}, answers={len(parsed['answers'])}"
        )

    if not rows:
        print("No questions were converted.", file=sys.stderr)
        sys.exit(1)

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} question(s) to {output_path}")


if __name__ == "__main__":
    main()
