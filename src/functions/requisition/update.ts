import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ClearCompanyClient, Requisition } from '../../lib/clearcompany/client';
import { PaylocityClient } from '../../lib/paylocity/client';
import { withMiddleware, formatResponse } from '../../lib/common/middleware';
import { ValidationError, NotFoundError } from '../../lib/common/errors';
import logger from '../../lib/common/logger';
import { requisitionSchema, updateRequisitionSchema } from './schema';
import { RequisitionRepository } from '../../lib/storage/requisitions';

export const updateRequisitionHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requisitionId = event.pathParameters?.id;
  const body = event.body as unknown as Partial<Requisition>;

  if (!requisitionId) {
    throw new ValidationError('Requisition ID is required');
  }

  try {
    // Validate request body using Zod
    const validatedData = requisitionSchema.partial().parse(body);

    // Initialize API clients
    const [clearCompanyClient, paylocityClient] = await Promise.all([
      ClearCompanyClient.getInstance(),
      PaylocityClient.getInstance(),
    ]);

    // Get existing requisition from persistence first
    const persisted = await RequisitionRepository.get(requisitionId);

    // Get existing requisition from ClearCompany if not in DB
    const existingRequisition = persisted || (await clearCompanyClient.getRequisition(requisitionId));
    if (!existingRequisition) {
      throw new NotFoundError('Requisition not found');
    }

    // Update requisition in ClearCompany
    logger.info('Updating requisition in ClearCompany', {
      requisitionId,
      updates: validatedData,
    });
    const updatedRequisition = await clearCompanyClient.updateRequisition(
      requisitionId,
      validatedData
    );

    // Persist changes
    await RequisitionRepository.updateFields(requisitionId, {
      ...(validatedData.title && { title: validatedData.title }),
      ...(validatedData.description && { description: validatedData.description }),
      ...(validatedData.department && { department: validatedData.department }),
      ...(validatedData.location && { location: validatedData.location }),
      ...(validatedData.employmentType && { employmentType: validatedData.employmentType }),
      ...(validatedData.status && { status: validatedData.status }),
      updatedAt: new Date().toISOString(),
    });

    // Update headcount plan in Paylocity if necessary fields changed
    if (validatedData.department || validatedData.title || validatedData.status) {
      logger.info('Updating headcount plan in Paylocity', {
        requisitionId,
      });

      const headcountPlan = await paylocityClient.getHeadcountPlanByRequisitionId(requisitionId);
      if (headcountPlan) {
        await paylocityClient.updateHeadcountPlan(headcountPlan.id!, {
          ...(validatedData.department && { department: validatedData.department }),
          ...(validatedData.title && { position: validatedData.title }),
          ...(validatedData.status && { status: validatedData.status }),
        });
      }
    }

    return formatResponse(200, { data: updatedRequisition });
  } catch (error) {
    if (error instanceof ValidationError) {
      return formatResponse(400, {
        error: {
          message: 'Invalid request body',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    if (error instanceof NotFoundError) {
      return formatResponse(404, {
        error: {
          message: error.message,
          code: 'NOT_FOUND',
        },
      });
    }

    throw error;
  }
};

export const handler = withMiddleware(updateRequisitionHandler, updateRequisitionSchema); 