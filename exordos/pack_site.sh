#!/usr/bin/env bash

#    Copyright 2026 Genesis Corporation.
#    Licensed under the Apache License, Version 2.0 (the "License")

# Prepares the static content for packing. The builder archives the `site/`
# directory into `site.tar.zst` after this script exits; the metronome has no
# build step, so the script only checks that the content is there.

set -eu
set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for f in index.html src/app.js src/metronome.js src/tempo.js src/i18n.js src/style.css; do
    if [ ! -f "${REPO_ROOT}/site/${f}" ]; then
        echo "site/${f} not found" >&2
        exit 1
    fi
done
