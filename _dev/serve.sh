#!/bin/sh
# Local shop preview without the real BE: mock API on :8080, static site on :8000.
# Open http://localhost:8000/shop/ (use localhost, not 127.0.0.1). Admin login: admin / admin.
# Ctrl+C stops both. The mock keeps data in memory and resets on restart.
cd "$(dirname "$0")/.."
python3 -I _dev/mock_api.py &
MOCK=$!
trap 'kill $MOCK' EXIT INT TERM
python3 -I _dev/site_server.py --mock
