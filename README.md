# ClearCompany-Paylocity Integration

This project implements a serverless integration between ClearCompany's ATS and Paylocity's Headcount Planning Tool using AWS SAM (Serverless Application Model). The integration enables seamless management of requisitions and candidate data flow between both systems.

## Architecture Overview

![Architecture Diagram](docs/architecture.png)

### Key Components

1. **API Gateway**: RESTful API endpoints for handling requests
2. **Lambda Functions**: Serverless functions for business logic
3. **DynamoDB**: For storing integration state and audit logs
4. **AWS Secrets Manager**: Secure storage of API credentials
5. **EventBridge**: For scheduling and managing webhook events
6. **Mock APIs**: Mock implementations of ClearCompany and Paylocity APIs for development and testing

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
- Node.js 18.x or later
- ClearCompany API credentials (or use mock APIs)
- Paylocity API credentials (or use mock APIs)

## Project Structure

```
.
├── src/
│   ├── functions/
│   │   ├── requisition/
│   │   ├── webhook/
│   │   ├── candidate/
│   │   └── mocks/           # Mock API implementations
│   ├── lib/
│   │   ├── clearcompany/
│   │   ├── paylocity/
│   │   └── common/
│   └── models/
├── docs/
│   ├── swagger/            # API Documentation
│   └── architecture.png
├── postman/               # Postman Collection and Environment
├── tests/
├── template.yaml          # Main SAM template
└── swagger-hosting.yaml   # Swagger hosting configuration
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
   # Deploy main application
   sam build
   sam deploy --guided

   # Deploy mock APIs (optional)
   sam deploy --template-file template.yaml --parameter-overrides UseMockApis=true

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
2. Import `Development.postman_environment.json`
3. Update environment variables:
   - `apiEndpoint`: Your API Gateway URL
   - `mockApiEndpoint`: Your mock API Gateway URL (if using mock APIs)
   - `apiKey`: Your API Gateway API key

### Endpoints

1. **Main API**
   - POST /api/requisitions
   - PUT /api/requisitions/{id}
   - GET /api/requisitions/{id}

2. **Webhook Handlers**
   - POST /api/webhooks/requisition-status
   - POST /api/webhooks/candidate-status

3. **Mock ClearCompany API**
   - POST /clearcompany/requisitions
   - PUT /clearcompany/requisitions/{id}
   - GET /clearcompany/requisitions/{id}
   - DELETE /clearcompany/requisitions/{id}

4. **Mock Paylocity API**
   - POST /paylocity/headcount-planning
   - PUT /paylocity/headcount-planning/{id}
   - GET /paylocity/headcount-planning/{id}
   - GET /paylocity/headcount-planning/requisition/{id}
   - DELETE /paylocity/headcount-planning/{id}

## Mock APIs

The project includes mock implementations of both ClearCompany and Paylocity APIs for development and testing purposes.

### Using Mock APIs

1. Deploy with mock APIs enabled:
   ```bash
   sam deploy --parameter-overrides UseMockApis=true
   ```

2. The mock APIs will:
   - Store data in DynamoDB tables
   - Emit events via EventBridge
   - Simulate webhook notifications
   - Provide realistic API responses

3. Mock API features:
   - Full CRUD operations
   - Data persistence
   - Event notifications
   - Error simulation
   - Realistic latency

## Development Guidelines

1. **Code Style**
   - Follow ESLint configuration
   - Use TypeScript for type safety
   - Follow SOLID principles

2. **Testing**
   - Write unit tests for all business logic
   - Integration tests for API endpoints
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

## Error Handling

- Centralized error handling middleware
- Custom error classes
- Consistent error response format
- Retry mechanisms for transient failures

## Deployment

### Development
```bash
sam build
sam deploy --guided --stack-name dev-integration
```

### Production
```bash
sam build
sam deploy --guided --stack-name prod-integration
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