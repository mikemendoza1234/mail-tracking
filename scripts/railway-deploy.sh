#!/bin/bash
echo "🚀 Deploying to Railway..."

# Set variables
railway variables set JWT_SECRET $(openssl rand -base64 32)
railway variables set NODE_ENV production

# Deploy
railway up

# Run migrations
echo "📦 Running migrations..."
railway run npm run migrate

# Check health
echo "🏥 Checking health..."
sleep 10
curl -f https://$RAILWAY_STATIC_URL/health || echo "Health check failed"

echo "✅ Deployment complete! URL: https://$RAILWAY_STATIC_URL"
