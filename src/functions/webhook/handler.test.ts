import { APIGatewayProxyEvent } from 'aws-lambda';
import { processWebhook } from './handler';
import { ClearCompanyClient } from '../../lib/clearcompany/client';
import { PaylocityClient } from '../../lib/paylocity/client';

// Mock the API clients
jest.mock('../../lib/clearcompany/client');
jest.mock('../../lib/paylocity/client');

describe('processWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Requisition Status Webhook', () => {
    const mockRequisitionWebhook = {
      type: 'requisition',
      entityId: '123',
      action: 'status_updated',
      data: {
        status: 'closed',
      },
    };

    const mockEvent = {
      path: '/api/webhooks/requisition-status',
      body: JSON.stringify(mockRequisitionWebhook),
    } as unknown as APIGatewayProxyEvent;

    it('should process requisition status update successfully', async () => {
      const mockHeadcountPlan = {
        id: '456',
        requisitionId: '123',
      };

      (PaylocityClient.getInstance as jest.Mock).mockResolvedValue({
        getHeadcountPlanByRequisitionId: jest.fn().mockResolvedValue(mockHeadcountPlan),
        updateHeadcountPlan: jest.fn().mockResolvedValue(mockHeadcountPlan),
      });

      const response = await processWebhook(mockEvent);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).data.message).toBe('Webhook processed successfully');
    });

    it('should handle missing headcount plan', async () => {
      (PaylocityClient.getInstance as jest.Mock).mockResolvedValue({
        getHeadcountPlanByRequisitionId: jest.fn().mockResolvedValue(null),
      });

      const response = await processWebhook(mockEvent);

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Candidate Status Webhook', () => {
    const mockCandidateWebhook = {
      type: 'candidate',
      entityId: '789',
      action: 'status_updated',
      data: {
        requisitionId: '123',
        status: 'hired',
      },
    };

    const mockEvent = {
      path: '/api/webhooks/candidate-status',
      body: JSON.stringify(mockCandidateWebhook),
    } as unknown as APIGatewayProxyEvent;

    it('should process candidate hired status successfully', async () => {
      const mockRequisition = {
        id: '123',
        status: 'open',
      };

      const mockHeadcountPlan = {
        id: '456',
        requisitionId: '123',
      };

      (ClearCompanyClient.getInstance as jest.Mock).mockResolvedValue({
        getRequisition: jest.fn().mockResolvedValue(mockRequisition),
        updateRequisition: jest.fn().mockResolvedValue({ ...mockRequisition, status: 'filled' }),
      });

      (PaylocityClient.getInstance as jest.Mock).mockResolvedValue({
        getHeadcountPlanByRequisitionId: jest.fn().mockResolvedValue(mockHeadcountPlan),
        updateHeadcountPlan: jest.fn().mockResolvedValue({
          ...mockHeadcountPlan,
          status: 'filled',
        }),
      });

      const response = await processWebhook(mockEvent);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).data.message).toBe('Webhook processed successfully');
    });

    it('should handle non-hired candidate status', async () => {
      const nonHiredWebhook = {
        ...mockCandidateWebhook,
        data: {
          ...mockCandidateWebhook.data,
          status: 'rejected',
        },
      };

      const mockEvent = {
        path: '/api/webhooks/candidate-status',
        body: JSON.stringify(nonHiredWebhook),
      } as unknown as APIGatewayProxyEvent;

      const response = await processWebhook(mockEvent);

      expect(response.statusCode).toBe(200);
    });
  });

  it('should handle validation errors', async () => {
    const invalidEvent = {
      path: '/api/webhooks/requisition-status',
      body: JSON.stringify({
        // Missing required fields
        type: 'requisition',
      }),
    } as unknown as APIGatewayProxyEvent;

    const response = await processWebhook(invalidEvent);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle API errors', async () => {
    const mockEvent = {
      path: '/api/webhooks/requisition-status',
      body: JSON.stringify({
        type: 'requisition',
        entityId: '123',
        action: 'status_updated',
        data: { status: 'closed' },
      }),
    } as unknown as APIGatewayProxyEvent;

    (PaylocityClient.getInstance as jest.Mock).mockResolvedValue({
      getHeadcountPlanByRequisitionId: jest.fn().mockRejectedValue(new Error('API Error')),
    });

    await expect(processWebhook(mockEvent)).rejects.toThrow();
  });
}); 