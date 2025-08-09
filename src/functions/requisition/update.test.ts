import { APIGatewayProxyEvent } from 'aws-lambda';
import { updateRequisitionHandler } from './update';
import { ClearCompanyClient } from '../../lib/clearcompany/client';
import { PaylocityClient } from '../../lib/paylocity/client';

// Mock the API clients
jest.mock('../../lib/clearcompany/client');
jest.mock('../../lib/paylocity/client');

describe('updateRequisitionHandler', () => {
  const mockRequisitionId = '123';
  const mockRequisition = {
    title: 'Updated Software Engineer',
    description: 'Updated Senior Software Engineer position',
    department: 'Engineering',
    location: 'Remote',
    employmentType: 'Full-time',
    status: 'Open',
  };

  const mockEvent = {
    pathParameters: { id: mockRequisitionId },
    body: JSON.stringify(mockRequisition),
  } as APIGatewayProxyEvent;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update a requisition successfully', async () => {
    // Mock ClearCompany client response
    const mockUpdatedRequisition = {
      ...mockRequisition,
      id: mockRequisitionId,
    };
    (ClearCompanyClient.getInstance as jest.Mock).mockResolvedValue({
      getRequisition: jest.fn().mockResolvedValue(mockUpdatedRequisition),
      updateRequisition: jest.fn().mockResolvedValue(mockUpdatedRequisition),
    });

    // Mock Paylocity client response
    const mockHeadcountPlan = {
      id: '456',
      requisitionId: mockRequisitionId,
    };
    (PaylocityClient.getInstance as jest.Mock).mockResolvedValue({
      getHeadcountPlanByRequisitionId: jest.fn().mockResolvedValue(mockHeadcountPlan),
      updateHeadcountPlan: jest.fn().mockResolvedValue(mockHeadcountPlan),
    });

    const response = await updateRequisitionHandler(mockEvent);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data).toEqual(mockUpdatedRequisition);
  });

  it('should handle missing requisition ID', async () => {
    const invalidEvent = {
      pathParameters: {},
      body: JSON.stringify(mockRequisition),
    } as APIGatewayProxyEvent;

    const response = await updateRequisitionHandler(invalidEvent);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle non-existent requisition', async () => {
    (ClearCompanyClient.getInstance as jest.Mock).mockResolvedValue({
      getRequisition: jest.fn().mockResolvedValue(null),
    });

    const response = await updateRequisitionHandler(mockEvent);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error.code).toBe('NOT_FOUND');
  });

  it('should handle validation errors', async () => {
    const invalidEvent = {
      pathParameters: { id: mockRequisitionId },
      body: JSON.stringify({
        // Invalid field
        invalidField: 'test',
      }),
    } as APIGatewayProxyEvent;

    const response = await updateRequisitionHandler(invalidEvent);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle ClearCompany API errors', async () => {
    (ClearCompanyClient.getInstance as jest.Mock).mockResolvedValue({
      getRequisition: jest.fn().mockResolvedValue({
        id: mockRequisitionId,
      }),
      updateRequisition: jest.fn().mockRejectedValue(new Error('API Error')),
    });

    await expect(updateRequisitionHandler(mockEvent)).rejects.toThrow();
  });

  it('should handle Paylocity API errors', async () => {
    (ClearCompanyClient.getInstance as jest.Mock).mockResolvedValue({
      getRequisition: jest.fn().mockResolvedValue({
        id: mockRequisitionId,
      }),
      updateRequisition: jest.fn().mockResolvedValue({
        ...mockRequisition,
        id: mockRequisitionId,
      }),
    });

    (PaylocityClient.getInstance as jest.Mock).mockResolvedValue({
      getHeadcountPlanByRequisitionId: jest.fn().mockResolvedValue({ id: '456' }),
      updateHeadcountPlan: jest.fn().mockRejectedValue(new Error('API Error')),
    });

    await expect(updateRequisitionHandler(mockEvent)).rejects.toThrow();
  });
}); 