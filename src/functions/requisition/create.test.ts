import { APIGatewayProxyEvent } from 'aws-lambda';
import { createRequisitionHandler } from './create';
import { ClearCompanyClient } from '../../lib/clearcompany/client';
import { PaylocityClient } from '../../lib/paylocity/client';

// Mock the API clients
jest.mock('../../lib/clearcompany/client');
jest.mock('../../lib/paylocity/client');

describe('createRequisitionHandler', () => {
  const mockRequisition = {
    title: 'Software Engineer',
    description: 'Senior Software Engineer position',
    department: 'Engineering',
    location: 'Remote',
    employmentType: 'Full-time',
    status: 'Open',
  };

  const mockEvent = {
    body: JSON.stringify(mockRequisition),
  } as APIGatewayProxyEvent;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a requisition successfully', async () => {
    // Mock ClearCompany client response
    const mockCreatedRequisition = {
      ...mockRequisition,
      id: '123',
    };
    (ClearCompanyClient.getInstance as jest.Mock).mockResolvedValue({
      createRequisition: jest.fn().mockResolvedValue(mockCreatedRequisition),
    });

    // Mock Paylocity client response
    (PaylocityClient.getInstance as jest.Mock).mockResolvedValue({
      createHeadcountPlan: jest.fn().mockResolvedValue({
        id: '456',
        requisitionId: '123',
      }),
    });

    const response = await createRequisitionHandler(mockEvent);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).data).toEqual(mockCreatedRequisition);
  });

  it('should handle validation errors', async () => {
    const invalidEvent = {
      body: JSON.stringify({
        // Missing required fields
        title: 'Software Engineer',
      }),
    } as APIGatewayProxyEvent;

    const response = await createRequisitionHandler(invalidEvent);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle ClearCompany API errors', async () => {
    (ClearCompanyClient.getInstance as jest.Mock).mockResolvedValue({
      createRequisition: jest.fn().mockRejectedValue(new Error('API Error')),
    });

    (PaylocityClient.getInstance as jest.Mock).mockResolvedValue({
      createHeadcountPlan: jest.fn(),
    });

    await expect(createRequisitionHandler(mockEvent)).rejects.toThrow();
  });

  it('should handle Paylocity API errors', async () => {
    (ClearCompanyClient.getInstance as jest.Mock).mockResolvedValue({
      createRequisition: jest.fn().mockResolvedValue({
        ...mockRequisition,
        id: '123',
      }),
    });

    (PaylocityClient.getInstance as jest.Mock).mockResolvedValue({
      createHeadcountPlan: jest.fn().mockRejectedValue(new Error('API Error')),
    });

    await expect(createRequisitionHandler(mockEvent)).rejects.toThrow();
  });
}); 