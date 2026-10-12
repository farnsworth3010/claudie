#!/bin/sh
# Builds the GNOME Shell extension into frontends/gnome/dist/ as Claudie-gnome.zip, the file a
# GitHub release carries. Plain zip, not `gnome-extensions pack`: there are no schemas to compile.
#   tools/build-gnome-extension.sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
uuid=claudie@farnsworth3010.github.io
cd "$root/frontends/gnome"
pnpm build
rm -f dist/Claudie-gnome.zip
(cd "dist/$uuid" && zip -q -r ../Claudie-gnome.zip .)
echo "$root/frontends/gnome/dist/Claudie-gnome.zip"
