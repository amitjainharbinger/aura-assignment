import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
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

async function handleRequisitionStatusUpdate(entityId: string, newStatus: string): Promise<void> {
  const paylocityClient = await PaylocityClient.getInstance();
  const headcountPlan = await paylocityClient.getHeadcountPlanByRequisitionId(entityId);
  if (headcountPlan) {
    await paylocityClient.updateHeadcountPlan(headcountPlan.id!, { status: newStatus });
  }
}

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
      if (webhookEvent.type === 'requisition' && webhookEvent.action === 'status_updated') {
        await handleRequisitionStatusUpdate(
          webhookEvent.entityId,
          webhookEvent.data.status as string
        );
      }
    } else if (path.includes('candidate-status')) {
      if (webhookEvent.type === 'candidate' && webhookEvent.action === 'status_updated') {
        const requisitionId = webhookEvent.data.requisitionId as string;
        const candidateStatus = webhookEvent.data.status as string;

        if (candidateStatus === 'hired') {
          const requisition = await clearCompanyClient.getRequisition(requisitionId);
          if (requisition) {
            await clearCompanyClient.updateRequisition(requisitionId, { status: 'filled' });
            const headcountPlan = await paylocityClient.getHeadcountPlanByRequisitionId(requisitionId);
            if (headcountPlan) {
              await paylocityClient.updateHeadcountPlan(
                headcountPlan.id!,
                ({ status: 'filled', endDate: new Date().toISOString() } as any)
              );
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

// EventBridge handler (no middleware)
export const eventsHandler = async (event: any): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('EventBridge event received', { source: event?.source, detailType: event?.['detail-type'], detail: event?.detail });

    if (event?.source === 'com.clearcompany.app' && event?.['detail-type'] === 'requisition.status_updated') {
      const detail = event.detail || {};
      const entityId: string = detail.entityId || detail.requisitionId;
      const status: string = detail.status || 'approved';
      await handleRequisitionStatusUpdate(entityId, status);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    logger.error('EventBridge handler error', { err });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false })
    };
  }
};

// Router that supports both API Gateway and EventBridge events
export const router = async (event: any, context: Context): Promise<any> => {
  const isEventBridge = !!event?.['detail-type'] && !!event?.source;
  if (isEventBridge) {
    return eventsHandler(event);
  }
  // Delegate to middy-wrapped API handler
  return (handler as any)(event, context);
}; 