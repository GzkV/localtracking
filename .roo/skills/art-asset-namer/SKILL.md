---
name: art-asset-namer
description: Reviews art/image assets in a project (PNG, JPG, SVG, WebP, GIF) using vision capabilities and renames generically named files (e.g. item_12.png, hero1.png) to semantic, function-based names (e.g. user-icon-white.png, arrow-left.png). Use when auditing, organizing, or renaming image/art assets, especially large packs of numbered items, and when all code references (HTML, CSS, JS, manifest.webmanifest, sw.js) must be updated to match.
---

# Art Asset Namer

## When to use this skill
- The project contains generically named image assets (`item_1.png` … `item_117.png`, `hero1.png`, `spritesheet1.png`, `wolf icons.png`).
- The user asks to review, organize, or rename art/image assets to meaningful, function-based names.
- Renames must be propagated through code references (HTML, CSS, JS, `manifest.webmanifest`, `sw.js`).

## When NOT to use this skill
- The user only wants a listing of assets with no renames (just run the inventory script).
- The task is editing image content itself (use an image editor instead).
- Assets are already semantically named and only code references need fixing (do a plain search/replace instead).

## Inputs required from the user
- Approval of the proposed rename mapping table BEFORE any rename is executed (mandatory).
- Optional: preferred naming style if different from kebab-case; approval for any directory moves.

## Workflow

1. **Inventory** — Execute [`scripts/list-assets.sh`](scripts/list-assets.sh) from the repo root to list all image assets (`png|jpg|jpeg|svg|webp|gif`) with paths and sizes. Note current names and locations. Do not read the script unless debugging; just run it.
2. **Reference check (before renaming)** — For each asset, grep the codebase for references before proposing renames:
   - `grep -rn "item_12" web/ server.js` (also check `web/manifest.webmanifest`, `web/sw.js`, `web/css/`, `web/js/`, `*.html`).
   - Record which assets are referenced in code vs. unreferenced.
3. **Visual review** — Use vision capabilities to actually LOOK at each image (read the image files) and determine what it depicts and its likely function: icon, arrow, button, background, sprite, motif, avatar, logo, illustration, etc.
   - **Batching:** for large sets (e.g. the 117-file `item_pack`), review in groups of ~10–20 images per batch. Track progress per batch.
4. **Propose names** — Use kebab-case, semantic, function-based names; keep extensions unchanged; keep directories unchanged unless the user approves moves.
   - Pattern: `<subject>-<role>[-<variant>].png`
   - Examples: `item_12.png` → `user-icon-white.png`, `item_34.png` → `arrow-left.png`, `item_5.png` → `wolf-icon-howling.png`.
   - Variant suffixes: `-white`, `-dark`, `-active`, `-disabled`, `-left`, `-right`, `-small`, `-2x`.
   - Handle collisions: if two images would get the same name, append a distinguishing variant or short descriptor (never bare numbers like `-2` unless nothing else distinguishes them).
5. **Present mapping for approval** — Output a table of `old path → new path` (grouped by directory) and STOP. Do not rename anything until the user explicitly approves the mapping.
6. **Execute renames** — After approval:
   - Use `git mv "old" "new"` for tracked files; fall back to `mv` for untracked files.
   - Quote paths containing spaces (e.g. `"web/assets/werewolf/wolf icons/item_1.png"`).
   - Re-check for collisions immediately before each rename.
7. **Update references** — For every renamed asset that was referenced in code, update all occurrences found in step 2 (HTML, CSS, JS, `manifest.webmanifest`, `sw.js`, `server.js`). Then re-run `node scripts/validate-assets.js` if present, and fix any reported issues.
8. **Report** — Summarize: number of assets renamed per directory, references updated per file, validation result, and any assets left unrenamed (with reasons, e.g. ambiguous content).

## Safety rules
- NEVER rename, move, or delete any asset before the user approves the full mapping table.
- NEVER delete assets. Unidentifiable or duplicate-looking assets are flagged in the report, not removed.
- Preserve file extensions and (by default) directory locations.
- Verify no target filename already exists before each rename; resolve collisions by refining the name, not overwriting.
- Batch large review sets; do not attempt to review 100+ images in a single pass.
- If `git mv` fails because the file is untracked, use `mv` and note it in the report.

## Files
- [`scripts/list-assets.sh`](scripts/list-assets.sh) — **Execute** from the repo root to inventory image assets. Output: `size_bytes  path` per line, sorted by path.

## Troubleshooting
- **Validation script fails after renames** — a reference was missed; re-grep for the old basename across the whole repo (including `web/sw.js` precache lists) and update it.
- **Image content is ambiguous** — mark it `needs-user-input` in the mapping table and ask the user to name it during approval.
- **Duplicate content, different files** — propose the same base name with distinct variant suffixes; flag the duplication in the final report.
