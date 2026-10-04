#!/usr/bin/env bash
# Smoke-test a built Sini image: version, ffmpeg, validate, a frame and a draft render.
# Usage: scripts/smoke-test-image.sh <image>
set -euo pipefail

image="${1:?usage: smoke-test-image.sh <image>}"
root="$(cd "$(dirname "$0")/.." && pwd)"
expected="$(node -p "require('$root/packages/cli/package.json').version")"

actual="$(docker run --rm "$image" --version)"
if [ "$actual" != "$expected" ]; then
  echo "Version mismatch: image says $actual, packages/cli says $expected" >&2
  exit 1
fi
docker run --rm --entrypoint ffmpeg "$image" -version | head -1

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp -r "$root/examples/novae" "$work/"
chmod -R a+rwX "$work"
docker run --rm -v "$work":/work "$image" validate novae
docker run --rm -v "$work":/work "$image" frame 4.5 novae -o novae/f.png
docker run --rm -v "$work":/work "$image" render novae --draft
test -s "$work/novae/out/draft.mp4"
echo "Smoke test passed: $image ($actual)"
