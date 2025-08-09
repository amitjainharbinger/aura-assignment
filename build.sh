#!/bin/bash

# Clean previous build
rm -rf dist
rm -rf .aws-sam

# Build TypeScript
npm run build

# Create function directories and copy lib
mkdir -p dist/functions/requisition/lib
mkdir -p dist/functions/webhook/lib
mkdir -p dist/functions/health

# Copy lib directory to each function
cp -r dist/lib/* dist/functions/requisition/lib/
cp -r dist/lib/* dist/functions/webhook/lib/

# Update import paths in the compiled files
find dist/functions -type f -name "*.js" -exec sed -i '' 's/\.\.\/\.\.\/lib/\.\/lib/g' {} +

# Create package.json files
echo '{
  "name": "requisition-function",
  "version": "1.0.0",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/client-secrets-manager": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "@middy/core": "^4.0.0",
    "@middy/http-json-body-parser": "^4.0.0",
    "@middy/http-error-handler": "^4.0.0",
    "@middy/validator": "^4.0.0",
    "axios": "^1.0.0",
    "winston": "^3.0.0",
    "zod": "^3.0.0"
  }
}' > dist/functions/requisition/package.json

echo '{
  "name": "webhook-function",
  "version": "1.0.0",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/client-secrets-manager": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "@middy/core": "^4.0.0",
    "@middy/http-json-body-parser": "^4.0.0",
    "@middy/http-error-handler": "^4.0.0",
    "@middy/validator": "^4.0.0",
    "axios": "^1.0.0",
    "winston": "^3.0.0",
    "zod": "^3.0.0"
  }
}' > dist/functions/webhook/package.json

# Install dependencies
cd dist/functions/requisition && npm install --production
cd ../webhook && npm install --production
cd ../../..

# Build and deploy SAM application
sam build