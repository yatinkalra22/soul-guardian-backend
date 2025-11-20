#!/bin/bash
# Script to set Raindrop environment variables from .env.raindrop
# Run this after deleting a deployment to restore env vars

set -e  # Exit on error

ENV_FILE=".env.raindrop"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found!"
    echo "Copy .env.raindrop.example to .env.raindrop and fill in your values"
    exit 1
fi

echo "📝 Reading environment variables from $ENV_FILE..."

# Source the env file
export $(cat "$ENV_FILE" | grep -v '^#' | xargs)

echo "🔧 Setting Raindrop environment variables..."

raindrop build env set api:env:WORKOS_CLIENT_ID "$WORKOS_CLIENT_ID"
raindrop build env set api:env:WORKOS_CLIENT_SECRET "$WORKOS_CLIENT_SECRET"
raindrop build env set api:env:WORKOS_COOKIE_PASSWORD "$WORKOS_COOKIE_PASSWORD"

echo "✅ Environment variables set successfully!"
echo ""
echo "You can now deploy with: npm run start"
