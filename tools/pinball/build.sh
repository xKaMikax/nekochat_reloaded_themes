#!/usr/bin/env bash
# Builds the Pinball add-on's WebAssembly files. Needs: git, cmake, 7z, an Emscripten SDK (emsdk) and the
# Windows XP disc image (for PINBALL.DAT and the SOUND*.WAV files; they are Microsoft's, not part of this repo).
#   tools/pinball/build.sh <work dir> <emsdk dir> "<path of the Windows XP .iso>"
set -euo pipefail
work="$1"; emsdk="$2"; iso="$3"; here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$work"; cd "$work"
[ -d src ] || git clone -q https://github.com/alula/SpaceCadetPinball src
(cd src && git checkout -q 0bc12d3 && git checkout -q -- . )
python3 "$here/apply_patches.py" "$work/src"
mkdir -p snd && (cd snd && 7z e -y "$iso" 'AMD64/SOUND*.WA_' >/dev/null && for f in SOUND*.WA_; do 7z e -y -o. "$f" >/dev/null; done)
7z e -y "$iso" I386/WPINBALL.DA_ >/dev/null && 7z x -y WPINBALL.DA_ >/dev/null && cp wpinball.dat src/game_resources/PINBALL.DAT
for f in snd/*.wav; do b=$(basename "$f" .wav); cp "$f" "src/game_resources/$(echo "$b" | tr a-z A-Z).WAV"; done
source "$emsdk/emsdk_env.sh" >/dev/null
mkdir -p build && cd build && emcmake cmake ../src -DCMAKE_BUILD_TYPE=Release >/dev/null && emmake make -j8
echo "Built: $work/src/bin/SpaceCadetPinball.{js,wasm,data}"
