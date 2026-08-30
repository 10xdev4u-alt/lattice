#!/usr/bin/env bash
# Build the runtime image and export it as a compressed tarball.
#
#   scripts/docker-artifact.sh            # lattice:runtime → lattice-image.tar.gz
#   scripts/docker-artifact.sh out.tar.gz
#
# The gzipped artifact is the lightweight shippable: the image
# itself is ~240MB (node:alpine base dominates), but compressed
# it lands around ~80MB, and `docker load <` restores it exactly.
set -euo pipefail

OUT="${1:-lattice-image.tar.gz}"
IMAGE="lattice:runtime"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> docker build --target runtime -t $IMAGE"
docker build --target runtime -t "$IMAGE" .

echo "==> docker save | gzip > $OUT"
docker save "$IMAGE" | gzip -6 > "$OUT"

LS="$(du -h "$OUT" | cut -f1)"
echo "==> done: $OUT ($LS)"
echo "    restore with: gunzip -c $OUT | docker load"
