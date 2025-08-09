#!/bin/bash
set -euo pipefail

# Deploy the Swagger hosting stack
sam deploy \
  --template-file swagger-hosting.yaml \
  --stack-name swagger-docs \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Environment=development \
  --no-confirm-changeset || true

# Resolve the bucket name from the stack resources
BUCKET_NAME=$(aws cloudformation describe-stack-resources \
  --stack-name swagger-docs \
  --logical-resource-id SwaggerBucket \
  --query 'StackResources[0].PhysicalResourceId' \
  --output text)

if [ -z "$BUCKET_NAME" ] || [ "$BUCKET_NAME" = "None" ]; then
  echo "Failed to resolve SwaggerBucket name" >&2
  exit 1
fi

echo "Uploading to bucket: $BUCKET_NAME"
aws s3 cp docs/swagger/index.html s3://$BUCKET_NAME/index.html --cache-control no-store
aws s3 cp docs/swagger/openapi.yaml s3://$BUCKET_NAME/openapi.yaml --cache-control no-store

# Get the Swagger documentation URL
SWAGGER_URL=$(aws cloudformation describe-stacks \
  --stack-name swagger-docs \
  --query 'Stacks[0].Outputs[?OutputKey==`SwaggerEndpoint`].OutputValue' \
  --output text)

echo "Swagger documentation is available at: $SWAGGER_URL"
