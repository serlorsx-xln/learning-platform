#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
EXAMPLE="$ROOT/.env.example"

if [[ -f "$ENV_FILE" ]]; then
  echo ".env already exists at $ENV_FILE"
  echo "Delete it first if you want to regenerate."
  exit 1
fi

cp "$EXAMPLE" "$ENV_FILE"

gen_hex() {
  openssl rand -hex 32
}

if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s/^ENCRYPTION_KEY=$/ENCRYPTION_KEY=$(gen_hex)/" "$ENV_FILE"
  sed -i '' "s/^INTERNAL_API_KEY=$/INTERNAL_API_KEY=$(gen_hex)/" "$ENV_FILE"
  sed -i '' "s/^BETTER_AUTH_SECRET=$/BETTER_AUTH_SECRET=$(gen_hex)/" "$ENV_FILE"
else
  sed -i "s/^ENCRYPTION_KEY=$/ENCRYPTION_KEY=$(gen_hex)/" "$ENV_FILE"
  sed -i "s/^INTERNAL_API_KEY=$/INTERNAL_API_KEY=$(gen_hex)/" "$ENV_FILE"
  sed -i "s/^BETTER_AUTH_SECRET=$/BETTER_AUTH_SECRET=$(gen_hex)/" "$ENV_FILE"
fi

echo "Created $ENV_FILE with generated secrets."
echo "Edit BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD before first run."
