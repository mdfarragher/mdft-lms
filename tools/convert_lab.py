#!/usr/bin/env python3
"""
convert_lab.py

Convert Hugo-format lab lesson markdown files into a Directus-compatible CSV
import file, matching the schema of lab_lesson_template.csv.

Usage:
    python convert_lab.py --module-slug <lab-module-slug> \
                          --slug-prefix <prefix> \
                          [--folder <path/to/lab_lessons>] \
                          [--user-id <uuid>] \
                          [--output <output.csv>]

Arguments:
    --module-slug   Slug of the lab module. Used to rewrite image paths from
                    ../img/filename.ext  ->  /media/lab/<module-slug>/filename.ext
    --slug-prefix   Prefix prepended to every generated lesson slug, e.g.
                    "cmn-cal-lab-" + "train-regression-model" -> "cmn-cal-lab-train-regression-model".
    --folder        Path to the folder containing markdown lesson files.
                    (default: lab_lessons)
    --user-id       Directus user UUID to use for user_created and user_updated.
                    (default: e1f46fac-fe3b-4973-b935-8ebbfc667b0d)
    --output        Output CSV file path.
                    (default: lab_output.csv in the same folder as this script)

Markdown format expected (Hugo front matter):
    ---
    title: "Lesson title"
    type: "lesson"
    layout: "default"
    sortkey: 10
    ---

    Lesson body text here.

    {{< encrypt >}}
    ... premium content ...
    {{< /encrypt >}}

CSV output columns (same as lab_lesson_template.csv):
    id, status, sort, user_created, date_created, user_updated, date_updated,
    title, slug, content
"""

import argparse
import csv
import os
import re
import sys
import unicodedata
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

# Words to omit when generating lesson slugs
STOP_WORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "nor",
    "of",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
    "from",
    "your",
    "my",
    "our",
    "its",
    "is",
    "are",
    "was",
    "were",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def now_iso() -> str:
    """Return the current UTC time in ISO-8601 format (Directus-compatible)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def title_to_slug(title: str, prefix: str = "") -> str:
    """
    Convert a title string to a URL-safe slug, then prepend prefix.
    - Normalise unicode to ASCII equivalents
    - Lowercase
    - Remove stop words (a, the, and, of, …)
    - Replace spaces (and runs of whitespace) with hyphens
    - Strip any character that is not alphanumeric or a hyphen
    """
    # Normalise unicode characters to their closest ASCII equivalents
    normalised = unicodedata.normalize("NFKD", title)
    ascii_text = normalised.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_text.lower()
    # Split into words, drop stop words, rejoin
    words = [w for w in lowered.split() if w not in STOP_WORDS]
    joined = "-".join(words)
    # Remove anything that is not alphanumeric or a hyphen
    slug = re.sub(r"[^a-z0-9\-]", "", joined)
    # Collapse multiple consecutive hyphens
    slug = re.sub(r"-{2,}", "-", slug)
    slug = slug.strip("-")
    return f"{prefix}{slug}" if prefix else slug


def rewrite_image_paths(content: str, module_slug: str) -> str:
    """
    Replace ../img/<filename> image references with
    /media/lab/<module_slug>/<filename>.
    """
    return re.sub(
        r"\.\./img/([^\s\)\"']+)",
        lambda m: f"/media/lab/{module_slug}/{m.group(1)}",
        content,
    )


def strip_encrypt_tags(content: str) -> str:
    """Remove {{< encrypt >}} and {{< /encrypt >}} shortcode tags."""
    content = re.sub(r"\{\{<\s*encrypt\s*>\}\}", "", content)
    content = re.sub(r"\{\{<\s*/encrypt\s*>\}\}", "", content)
    return content


def parse_markdown_file(
    filepath: Path, module_slug: str, slug_prefix: str
) -> dict | None:
    """
    Parse a single Hugo-format lab lesson markdown file.

    Returns a dict with keys:
        title, slug, sort, content
    or None if the file should be skipped.
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

    title = str(fm.get("title", "")).strip()
    if not title:
        print(f"  WARNING: no title in {filepath.name}, skipping", file=sys.stderr)
        return None

    sort_key = fm.get("sortkey", None)

    # Clean up content
    body = strip_encrypt_tags(body)
    body = rewrite_image_paths(body, module_slug)
    body = body.strip()

    return {
        "title": title,
        "slug": title_to_slug(title, slug_prefix),
        "sort": sort_key,
        "content": body,
    }


def build_csv_row(
    sort_index: int,
    parsed: dict,
    created_at: str,
    user_id: str,
) -> dict:
    """
    Build a single CSV row dict from a parsed markdown lab lesson.
    """
    lesson_id = str(uuid.uuid4())

    # Use the sortkey from front matter if present, otherwise fall back to
    # the file discovery order (1-based sort_index).
    sort_value = parsed["sort"] if parsed["sort"] is not None else sort_index

    return {
        "id": lesson_id,
        "status": STATUS,
        "sort": sort_value,
        "user_created": user_id,
        "date_created": created_at,
        "user_updated": user_id,
        "date_updated": created_at,
        "title": parsed["title"],
        "slug": parsed["slug"],
        "content": parsed["content"],
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert Hugo lab lesson markdown files to a Directus-compatible CSV."
    )
    parser.add_argument(
        "--module-slug",
        required=True,
        help="Slug of the lab module, e.g. 'cmn-lab-process-california-housing'. "
        "Used to rewrite image paths to /media/lab/<module-slug>/filename.",
    )
    parser.add_argument(
        "--slug-prefix",
        required=True,
        help="Prefix prepended to every lesson slug, e.g. 'cmn-cal-lab-'. "
        "The prefix is applied after stop words are removed from the title.",
    )
    parser.add_argument(
        "--folder",
        default="lab_lessons",
        help="Path to the folder containing markdown lesson files (default: lab_lessons)",
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
        help="Output CSV file path (default: lab_output.csv next to this script)",
    )
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"ERROR: Folder not found: {folder}", file=sys.stderr)
        sys.exit(1)

    output_path = (
        Path(args.output) if args.output else Path(__file__).parent / "lab_output.csv"
    )

    # Collect all .md files, sorted by sortkey (front matter) then filename
    md_files: list[Path] = sorted(folder.glob("*.md"), key=lambda p: p.name)

    if not md_files:
        print(f"No markdown files found in {folder}", file=sys.stderr)
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
        "title",
        "slug",
        "content",
    ]

    rows: list[dict] = []
    for sort_index, filepath in enumerate(md_files, start=1):
        print(f"  Processing {filepath.name} ...", end=" ")
        parsed = parse_markdown_file(filepath, args.module_slug, args.slug_prefix)
        if parsed is None:
            print("skipped")
            continue
        row = build_csv_row(sort_index, parsed, created_at, args.user_id)
        rows.append(row)
        print(f"ok  ->  slug={row['slug']}, sort={row['sort']}")

    if not rows:
        print("No lessons were converted.", file=sys.stderr)
        sys.exit(1)

    # Re-sort rows by the sort value before writing
    rows.sort(key=lambda r: (r["sort"] is None, r["sort"]))

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} lesson(s) to {output_path}")


if __name__ == "__main__":
    main()
