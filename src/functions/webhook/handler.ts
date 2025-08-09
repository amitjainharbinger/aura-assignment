import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ClearCompanyClient } from '../../lib/clearcompany/client';
import { PaylocityClient } from '../../lib/paylocity/client';
import { withMiddleware, formatResponse } from '../../lib/common/middleware';
import { ValidationError } from '../../lib/common/errors';
import logger from '../../lib/common/logger';

interface WebhookEvent {
  type: string;
  entityId: string;
  action: string;
  data: Record<string, unknown>;
}

const webhookSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        type: { type: 'string', minLength: 1 },
        entityId: { type: 'string', minLength: 1 },
        action: { type: 'string', minLength: 1 },
        data: { type: 'object', additionalProperties: true },
      },
      required: ['type', 'entityId', 'action', 'data'],
      additionalProperties: false,
    },
  },
  required: ['body'],
};

export const processWebhook = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const webhookEvent = event.body as unknown as WebhookEvent;
  const path = event.path;

  try {
    logger.info('Processing webhook', {
      type: webhookEvent.type,
      entityId: webhookEvent.entityId,
      action: webhookEvent.action,
    });

    // Initialize API clients
    const [clearCompanyClient, paylocityClient] = await Promise.all([
      ClearCompanyClient.getInstance(),
      PaylocityClient.getInstance(),
    ]);

    // Handle different webhook types
    if (path.includes('requisition-status')) {
      // Handle requisition status webhook from ClearCompany
      if (webhookEvent.type === 'requisition' && webhookEvent.action === 'status_updated') {
        const requisitionId = webhookEvent.entityId;
        const newStatus = webhookEvent.data.status as string;

        // Get the headcount plan from Paylocity
        const headcountPlan = await paylocityClient.getHeadcountPlanByRequisitionId(requisitionId);
        if (headcountPlan) {
          // Update the status in Paylocity
          await paylocityClient.updateHeadcountPlan(headcountPlan.id!, {
            status: newStatus,
          });
        }
      }
    } else if (path.includes('candidate-status')) {
      // Handle candidate status webhook
      if (webhookEvent.type === 'candidate' && webhookEvent.action === 'status_updated') {
        const requisitionId = webhookEvent.data.requisitionId as string;
        const candidateStatus = webhookEvent.data.status as string;

        // Update requisition in ClearCompany if needed based on candidate status
        if (candidateStatus === 'hired') {
          const requisition = await clearCompanyClient.getRequisition(requisitionId);
          if (requisition) {
            // Update requisition status to filled
            await clearCompanyClient.updateRequisition(requisitionId, {
              status: 'filled',
            });

            // Update headcount plan in Paylocity
            const headcountPlan = await paylocityClient.getHeadcountPlanByRequisitionId(requisitionId);
            if (headcountPlan) {
              await paylocityClient.updateHeadcountPlan(headcountPlan.id!, {
                status: 'filled',
                endDate: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return formatResponse(200, { data: { message: 'Webhook processed successfully' } });
  } catch (error) {
    if (error instanceof ValidationError) {
      return formatResponse(400, {
        error: {
          message: 'Invalid webhook payload',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    throw error;
  }
};

export const handler = withMiddleware(processWebhook, webhookSchema); 