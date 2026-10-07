#!/usr/bin/env bash
# Compatibility with the requested filename; deploy.sh is the main entrypoint.
set -euo pipefail
exec bash "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/deploy.sh" "$@"
