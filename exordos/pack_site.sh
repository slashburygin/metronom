#!/usr/bin/env bash

#    Copyright 2026 Genesis Corporation.
#    Licensed under the Apache License, Version 2.0 (the "License")

# Builds the static content before Exordos archives dist/site/ as site.tar.zst.

set -eu
set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${REPO_ROOT}"
npm run build

for f in index.html help.html sw.js manifest.webmanifest icons/icon-192.png icons/icon-512.png robots.txt sitemap.xml favicon.svg yandex_631a0a33d8d10bed.html lessons/haimovich/schedule.json; do
    if [ ! -f "${REPO_ROOT}/dist/site/${f}" ]; then
        echo "dist/site/${f} not found" >&2
        exit 1
    fi
done
