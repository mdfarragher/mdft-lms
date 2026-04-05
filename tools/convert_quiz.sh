#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$SCRIPT_DIR/convert_quiz.py" \
    --folder "$SCRIPT_DIR/quiz_questions" \
    --slug-prefix "sml-rg-q" \
    --user-id "e1f46fac-fe3b-4973-b935-8ebbfc667b0d" \
    --output "$SCRIPT_DIR/quiz_output.csv"
