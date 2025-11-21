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
echo ""

# Check if variables are set
if [ -z "$WORKOS_CLIENT_ID" ] || [ -z "$WORKOS_CLIENT_SECRET" ] || [ -z "$WORKOS_COOKIE_PASSWORD" ]; then
    echo "❌ Error: Missing required environment variables in $ENV_FILE"
    echo "Required: WORKOS_CLIENT_ID, WORKOS_CLIENT_SECRET, WORKOS_COOKIE_PASSWORD"
    exit 1
fi

echo "   Setting WORKOS_CLIENT_ID..."
raindrop build env set api:env:WORKOS_CLIENT_ID "$WORKOS_CLIENT_ID" > /dev/null

echo "   Setting WORKOS_CLIENT_SECRET..."
raindrop build env set api:env:WORKOS_CLIENT_SECRET "$WORKOS_CLIENT_SECRET" > /dev/null

echo "   Setting WORKOS_COOKIE_PASSWORD..."
raindrop build env set api:env:WORKOS_COOKIE_PASSWORD "$WORKOS_COOKIE_PASSWORD" > /dev/null

echo "   Setting ALLOWED_ORIGINS..."
raindrop build env set api:env:ALLOWED_ORIGINS "$ALLOWED_ORIGINS" > /dev/null

echo ""
echo "✅ Environment variables set successfully!"
echo ""
echo "💡 Next steps:"
echo "   • First deployment:  npm run start"
echo "   • Update existing:   npm run deploy"
echo "   • Full redeploy:     npm run restart"
