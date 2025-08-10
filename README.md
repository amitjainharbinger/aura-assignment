# ClearCompany-Paylocity Integration

This project implements a serverless integration between ClearCompany's ATS and Paylocity's Headcount Planning Tool using AWS SAM (Serverless Application Model). The integration enables seamless management of requisitions and candidate data flow between both systems.

## Architecture Overview

![Architecture Diagram](docs/architecture.png)

### Key Components

1. **API Gateway**: RESTful API endpoints with CORS support and API key authentication
2. **Lambda Functions**: Serverless functions for business logic with DRY_RUN mode support
3. **DynamoDB**: For storing requisition records and integration state
4. **AWS Secrets Manager**: Secure storage of API credentials
5. **EventBridge**: For event-driven architecture and automatic webhook triggering

## Features

- **Requisition Management**
  - Create/Update requisitions in ClearCompany
  - Synchronize job templates and fields
  - Custom field mapping support
  
- **Job Requisition Status Updates**
  - Real-time status synchronization
  - Webhook integration for updates
  
- **Candidate Status Feedback**
  - Bi-directional candidate information flow
  - Status update notifications
  
- **Error Management**
  - Comprehensive error handling
  - Retry mechanisms
  - Notification system for critical errors

## Prerequisites

- AWS Account with appropriate permissions
- AWS SAM CLI installed
- Docker (for local testing with SAM)
- Node.js 18.x or later
- ClearCompany API credentials (optional - can use DRY_RUN mode)
- Paylocity API credentials (optional - can use DRY_RUN mode)

## Project Structure

```
.
├── src/
│   ├── functions/
│   │   ├── health/         # Health check endpoint
│   │   ├── requisition/    # Create/update requisitions
│   │   └── webhook/        # Webhook handlers
│   ├── lib/
│   │   ├── clearcompany/   # ClearCompany client with DRY_RUN support
│   │   ├── paylocity/      # Paylocity client with DRY_RUN support
│   │   ├── storage/        # DynamoDB operations
│   │   └── common/         # Shared utilities
├── docs/                  # Documentation
│   ├── swagger/           # API Documentation
│   └── *.md              # Architecture and solution docs
├── postman/              # Postman Collection and Environment
├── tests/                # Unit tests
├── template.yaml         # Main SAM template
└── swagger-hosting.yaml  # Swagger hosting configuration
```

## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone [repository-url]
   cd clearcompany-paylocity-integration
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure AWS Credentials**
   ```bash
   aws configure
   ```

4. **Set up Environment Variables**
   - Copy `.env.example` to `.env`
   - Update with your API credentials and configuration

5. **Deploy the Application**
   ```bash
   # Build and deploy the application
   ./build.sh
   sam deploy --stack-name sam-app --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides Environment=development LogLevel=info

   # Deploy Swagger documentation
   ./deploy-swagger.sh
   ```

## API Documentation

### Swagger Documentation

The API documentation is hosted on S3 and accessible via:
```
http://swagger-docs-swagger-docs.s3-website-us-east-1.amazonaws.com
```

To update the Swagger documentation:
1. Edit the OpenAPI specification in `docs/swagger/openapi.yaml`
2. Deploy changes:
   ```bash
   ./deploy-swagger.sh
   ```

### Postman Collection

A Postman collection is available in the `postman` directory:
1. Import `ClearCompany-Paylocity-Integration.postman_collection.json`
2. Import `Production.postman_environment.json`
3. Update environment variables:
   - `apiEndpoint`: Your API Gateway URL
   - `apiKey`: Your API Gateway API key

### Endpoints

1. **Health Check**
   - GET /health

2. **Requisition Management**
   - POST /api/requisitions
   - PUT /api/requisitions/{id}

3. **Webhook Handlers**
   - POST /api/webhooks/requisition-status
   - POST /api/webhooks/candidate-status

## DRY_RUN Mode

The application includes a `DRY_RUN` mode for development and testing without external API dependencies.

### Using DRY_RUN Mode

DRY_RUN mode is enabled by default in the SAM template:
```yaml
# In template.yaml
Globals:
  Function:
    Environment:
      Variables:
        DRY_RUN: "true"
```

When DRY_RUN is enabled, the application will:
- Skip external API calls to ClearCompany and Paylocity
- Return stubbed responses with realistic data
- Still persist data to DynamoDB for testing workflows
- Publish EventBridge events for complete flow testing
- Generate dynamic UUIDs for realistic simulation

### Benefits
- **Cost Optimization**: No external API charges during development
- **Reliability**: Consistent responses for testing
- **Speed**: Faster execution without network calls
- **Isolation**: Test business logic independently

## Development Guidelines

1. **Code Style**
   - Follow ESLint configuration
   - Use TypeScript for type safety
   - Follow SOLID principles

2. **Testing**
   - Write unit tests for all business logic
   - Integration tests using DRY_RUN mode
   - End-to-end testing with Postman
   - Run tests: `npm test`

3. **Security Best Practices**
   - Input validation
   - Error handling
   - Secrets management
   - API authentication
   - OWASP security guidelines

4. **Logging and Monitoring**
   - Structured logging format
   - CloudWatch integration
   - Error tracking
   - Performance metrics

5. **Local Development**
   - Use `sam local start-api` for local API testing
   - Requires Docker for Lambda runtime simulation
   - DRY_RUN mode works in local environment
   - Test with `sam local invoke` for individual functions

## Error Handling

- Centralized error handling middleware
- Custom error classes
- Consistent error response format
- Retry mechanisms for transient failures

## Deployment

### Development
```bash
./build.sh
sam deploy --stack-name sam-app --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides Environment=development LogLevel=info
```

### Production
```bash
# Set DRY_RUN to false for production
# Update template.yaml: DRY_RUN: "false"
./build.sh
sam deploy --stack-name prod-integration --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides Environment=production LogLevel=warn
```

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run all tests with coverage
npm run test:coverage
```

## Monitoring and Logging

- CloudWatch Logs for Lambda functions
- CloudWatch Metrics for API Gateway  
- X-Ray for distributed tracing
- Custom metrics for business KPIs

### Viewing DynamoDB Data

To view stored requisition data:
```bash
# List all items in the table
aws dynamodb scan --table-name sam-app-integration-state

# Get specific requisition
aws dynamodb get-item --table-name sam-app-integration-state --key '{"id": {"S": "your-requisition-id"}}'
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[License Type] - see LICENSE.md for details

## Support

For support and questions, please contact:
- Email: [support-email]
- JIRA: [project-key]

## Version History

- 1.0.0: Initial release
  - Basic integration functionality
  - Webhook support
  - Error handling
  - Mock API implementation
  - Swagger documentation
  - Postman collection

## Authors

- [Author Name] - *Initial work* - [Organization]

## Acknowledgments

- ClearCompany API Documentation
- Paylocity API Documentation
- AWS SAM Documentation