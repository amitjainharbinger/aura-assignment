#!/bin/bash

# Deploy the Swagger hosting stack
sam deploy \
  --template-file swagger-hosting.yaml \
  --stack-name swagger-docs \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Environment=development \
  --no-confirm-changeset

# Get the S3 bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name swagger-docs \
  --query 'Stacks[0].Outputs[?OutputKey==`SwaggerEndpoint`].OutputValue' \
  --output text | sed 's/http:\/\///' | sed 's/\/.*//')

# Upload Swagger files to S3
aws s3 cp docs/swagger/index.html s3://$BUCKET_NAME/
aws s3 cp docs/swagger/openapi.yaml s3://$BUCKET_NAME/

# Get the Swagger documentation URL
SWAGGER_URL=$(aws cloudformation describe-stacks \
  --stack-name swagger-docs \
  --query 'Stacks[0].Outputs[?OutputKey==`SwaggerEndpoint`].OutputValue' \
  --output text)

echo "Swagger documentation is available at: $SWAGGER_URL"
