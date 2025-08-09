import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ClearCompanyClient, Requisition } from '../../lib/clearcompany/client';
import { PaylocityClient } from '../../lib/paylocity/client';
import { withMiddleware, formatResponse } from '../../lib/common/middleware';
import { ValidationError } from '../../lib/common/errors';
import logger from '../../lib/common/logger';
import { requisitionSchema, createRequisitionSchema } from './schema';

export const createRequisitionHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const body = event.body as unknown as Requisition;

  try {
    // Validate request body using Zod
    const validatedData = requisitionSchema.parse(body);

    // Initialize API clients
    const [clearCompanyClient, paylocityClient] = await Promise.all([
      ClearCompanyClient.getInstance(),
      PaylocityClient.getInstance(),
    ]);

    // Create requisition in ClearCompany
    logger.info('Creating requisition in ClearCompany', { requisition: validatedData });
    const createdRequisition = await clearCompanyClient.createRequisition(validatedData);

    // Create corresponding headcount plan in Paylocity
    logger.info('Creating headcount plan in Paylocity', {
      requisitionId: createdRequisition.id,
    });

    await paylocityClient.createHeadcountPlan({
      requisitionId: createdRequisition.id!,
      department: createdRequisition.department,
      position: createdRequisition.title,
      startDate: new Date().toISOString(),
      status: createdRequisition.status,
      headcount: 1,
      budget: 0, // This should be fetched from somewhere or calculated
    });

    return formatResponse(201, { data: createdRequisition });
  } catch (error) {
    if (error instanceof ValidationError) {
      return formatResponse(400, {
        error: {
          message: 'Invalid request body',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    throw error;
  }
};

export const handler = withMiddleware(createRequisitionHandler, createRequisitionSchema); 