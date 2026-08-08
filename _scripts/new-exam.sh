#!/usr/bin/env bash
#
# new-exam.sh — scaffold a new, fully isolated exam folder.
#
# Usage:
#   ./_scripts/new-exam.sh <VENDOR> <FOLDER> "<EXAM NAME>" <EXAM_CODE>
#
# Example:
#   ./_scripts/new-exam.sh AWS AWSSAA "AWS Certified Solutions Architect – Associate" SAA-C03
#   ./_scripts/new-exam.sh Azure AZ104 "Microsoft Azure Administrator" AZ-104
#
# Creates <VENDOR>/<FOLDER>/ from _TEMPLATE/ with placeholders replaced,
# including that folder's own CLAUDE.md / GEMINI.md / AGENTS.md / llms.txt.

set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "Usage: $0 <VENDOR> <FOLDER> \"<EXAM NAME>\" <EXAM_CODE>" >&2
  echo "Example: $0 AWS AWSSAA \"AWS Certified Solutions Architect – Associate\" SAA-C03" >&2
  exit 1
fi

VENDOR="$1"
FOLDER="$2"
EXAM_NAME="$3"
EXAM_CODE="$4"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$ROOT/_TEMPLATE"
DEST="$ROOT/$VENDOR/$FOLDER"

if [ ! -d "$TEMPLATE" ]; then
  echo "Error: _TEMPLATE not found at $TEMPLATE" >&2
  exit 1
fi

if [ -e "$DEST" ]; then
  echo "Error: $DEST already exists. Refusing to overwrite." >&2
  exit 1
fi

mkdir -p "$ROOT/$VENDOR"
cp -r "$TEMPLATE" "$DEST"

# Substitute placeholders in every file
find "$DEST" -type f -print0 | while IFS= read -r -d '' f; do
  tmp="$(mktemp)"
  sed -e "s|{{VENDOR}}|${VENDOR}|g" \
      -e "s|{{FOLDER}}|${FOLDER}|g" \
      -e "s|{{EXAM_NAME}}|${EXAM_NAME}|g" \
      -e "s|{{EXAM_CODE}}|${EXAM_CODE}|g" \
      "$f" > "$tmp"
  mv "$tmp" "$f"
done

# Duplicate the agent context file under the other two conventional names
cp "$DEST/CLAUDE.md" "$DEST/GEMINI.md"
cp "$DEST/CLAUDE.md" "$DEST/AGENTS.md"
sed -i 's|# CLAUDE.md —|# GEMINI.md —|' "$DEST/GEMINI.md"
sed -i 's|# CLAUDE.md —|# AGENTS.md —|' "$DEST/AGENTS.md"

echo "Created $VENDOR/$FOLDER/"
echo
echo "Next steps:"
echo "  1. Fill in the exam facts in $VENDOR/$FOLDER/CLAUDE.md sections 2, 3, 6, 7, 8"
echo "     (then re-copy it over GEMINI.md and AGENTS.md to keep them identical)"
echo "  2. Fill in $VENDOR/$FOLDER/README.md exam facts"
echo "  3. Add a row to the exam registry in $ROOT/CLAUDE.md and $ROOT/README.md"
echo
echo "Reminder: this folder is isolated. Do not carry conventions from"
echo "another exam folder into it — domain weights and formats differ."
