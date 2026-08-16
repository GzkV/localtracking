#!/bin/sh
# Copy the selected artwork into the served web root.
# Run from the project root with: sh scripts/copy-ui-assets.sh
set -eu

mkdir -p web/assets
pack='assets-src/werewolf/item-pack'
icons='assets-src/werewolf/icons'
motifs='assets-src/werewolf/motifs'

cp "$pack/forest background.png" web/assets/
cp "$pack/moonlit-sky-panel-background.png" web/assets/
cp "$pack/moonlit-wolf-banner-sprite.png" web/assets/
cp "$pack/crescent-star-motif-lavender.png" web/assets/
cp "$pack/sparkle-motif-icy.png" web/assets/
cp "$pack/home-icon-cyan.png" web/assets/
cp "$pack/calendar-wolf-moon-icon.png" web/assets/
cp "$pack/calendar-check-icon-cyan.png" web/assets/
cp "$pack/settings-gear-icon-cyan.png" web/assets/
cp "$pack/bell-icon-gold.png" web/assets/
cp "$pack/bell-icon-cyan.png" web/assets/
cp "$pack/user-icon-teal.png" web/assets/
cp "$pack/trend-up-icon-cyan.png" web/assets/
cp "$pack/undo-icon-left.png" web/assets/
cp "$pack/moon-phase-icon-cyan-glow.png" web/assets/
cp "$pack/moon-icon-crescent-left-bright.png" web/assets/
cp "$pack/moon-icon-full-cyan.png" web/assets/
cp "$pack/blood-drop-icon-pink-pale.png" web/assets/
cp "$pack/blood-drop-icon-cyan-pink.png" web/assets/
cp "$pack/potion-drop-icon-peach-lavender.png" web/assets/
cp "$pack/potion-drop-icon-peach-purple.png" web/assets/
cp "$pack/chevron-left-icon-dark.png" web/assets/
cp "$pack/chevron-right-icon-slate.png" web/assets/
cp "$pack/eclipse-ring-icon-icy.png" web/assets/
cp "$pack/wolf-avatar-howling-moon.png" web/assets/
cp "$icons/wolf-icon-lavender-front.png" web/assets/
cp "$motifs/wolf-moon-medallion-motif-ornate.png" web/assets/
cp "$motifs/crescent-star-corner-motif-gold-upper-left.png" web/assets/

echo 'Copied selected Moon.Time UI assets into web/assets/'
