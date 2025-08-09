#!/bin/bash
# Echo AI CLI Wrapper Script
# Usage: ./run-echo.sh agents list

cd "$(dirname "$0")"
node dist/cli.js "$@"