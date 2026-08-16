#!/bin/sh
# list-assets.sh — inventory image assets in the project.
# Usage: run from the repo root:  sh .roo/skills/art-asset-namer/scripts/list-assets.sh
# Output: "<size_bytes>  <path>" per line, sorted by path. Excludes .git and node_modules.

find . \
  -type d \( -name .git -o -name node_modules \) -prune -o \
  -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \
             -o -iname '*.svg' -o -iname '*.webp' -o -iname '*.gif' \) -print \
  | sed 's|^\./||' \
  | sort \
  | while IFS= read -r f; do
      size=$(wc -c < "$f" | tr -d ' ')
      printf '%10s  %s\n' "$size" "$f"
    done
