import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ClearCompanyClient, Requisition } from '../../lib/clearcompany/client';
import { PaylocityClient } from '../../lib/paylocity/client';
import { withMiddleware, formatResponse } from '../../lib/common/middleware';
import { ValidationError } from '../../lib/common/errors';
import logger from '../../lib/common/logger';
import { requisitionSchema, createRequisitionSchema } from './schema';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { RequisitionRepository, RequisitionRecord } from '../../lib/storage/requisitions';
import { randomUUID } from 'crypto';

const eventBridge = new EventBridgeClient({});

async function publishRequisitionStatusUpdate(requisitionId: string, status: string): Promise<void> {
  try {
    const busName = process.env.EVENT_BUS_NAME;
    if (!busName) {
      logger.info('EVENT_BUS_NAME not set; skipping event publish');
      return;
    }
    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Source: 'com.clearcompany.app',
            DetailType: 'requisition.status_updated',
            Detail: JSON.stringify({ entityId: requisitionId, status }),
          },
        ],
      })
    );
    logger.info('Published requisition.status_updated', { requisitionId, status });
  } catch (err) {
    logger.error('Failed to publish requisition.status_updated', { err, requisitionId, status });
  }
}

export const createRequisitionHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logger.info('createRequisitionHandler:start');

  const body = event.body as unknown as Requisition;
  logger.info('createRequisitionHandler:parsedBody', { rawType: typeof event.body, body });

  // Short-circuit when running under SAM local to isolate issues
  const isSamLocal = String(process.env.AWS_SAM_LOCAL || '').toLowerCase() === 'true';
  logger.info('createRequisitionHandler:isSamLocalCheck', { AWS_SAM_LOCAL: process.env.AWS_SAM_LOCAL, isSamLocal });
  if (isSamLocal) {
    logger.info('createRequisitionHandler:shortCircuit:samLocal');
    const id = randomUUID();
    const now = new Date().toISOString();
    const rec: RequisitionRecord = {
      id,
      title: body.title,
      description: body.description,
      department: body.department,
      location: body.location,
      employmentType: body.employmentType,
      status: body.status,
      salary: (body as any).salary,
      requirements: (body as any).requirements,
      benefits: (body as any).benefits,
      createdAt: now,
      updatedAt: now,
    };
    await RequisitionRepository.put(rec);
    await publishRequisitionStatusUpdate(id, 'approved');
    return formatResponse(201, { data: { id, ...body } });
  }

  // DRY_RUN: short-circuit for local testing to isolate errors
  const isDryRun = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
  logger.info('createRequisitionHandler:isDryRunCheck', { DRY_RUN: process.env.DRY_RUN, isDryRun });
  if (isDryRun) {
    logger.info('createRequisitionHandler:shortCircuit:dryRun');
    const stubId = randomUUID();
    const now = new Date().toISOString();
    const rec: RequisitionRecord = {
      id: stubId,
      title: body.title,
      description: body.description,
      department: body.department,
      location: body.location,
      employmentType: body.employmentType,
      status: body.status,
      salary: (body as any).salary,
      requirements: (body as any).requirements,
      benefits: (body as any).benefits,
      createdAt: now,
      updatedAt: now,
    };
    await RequisitionRepository.put(rec);
    await publishRequisitionStatusUpdate(stubId, 'approved');
    return formatResponse(201, { data: { id: stubId, ...body } });
  }

  try {
    // Validate request body using Zod
    logger.info('createRequisitionHandler:validate:begin');
    const validatedData = requisitionSchema.parse(body);
    logger.info('createRequisitionHandler:validate:ok', { validatedData });

    // Initialize API clients
    logger.info('createRequisitionHandler:initClients:begin');
    const [clearCompanyClient, paylocityClient] = await Promise.all([
      ClearCompanyClient.getInstance(),
      PaylocityClient.getInstance(),
    ]);
    logger.info('createRequisitionHandler:initClients:ok');

    // Create requisition in ClearCompany
    logger.info('createRequisitionHandler:clearcompany:create:begin', { requisition: validatedData });
    const createdRequisition = await clearCompanyClient.createRequisition(validatedData);
    // Fallback id if provider omitted it
    if (!createdRequisition.id) {
      createdRequisition.id = randomUUID();
    }
    logger.info('createRequisitionHandler:clearcompany:create:ok', { createdRequisition });

    // Persist to DynamoDB
    const now = new Date().toISOString();
    const record: RequisitionRecord = {
      id: createdRequisition.id,
      title: createdRequisition.title,
      description: createdRequisition.description,
      department: createdRequisition.department,
      location: createdRequisition.location,
      employmentType: createdRequisition.employmentType,
      status: createdRequisition.status,
      salary: (createdRequisition as any).salary,
      requirements: (createdRequisition as any).requirements,
      benefits: (createdRequisition as any).benefits,
      createdAt: now,
      updatedAt: now,
    };
    await RequisitionRepository.put(record);

    // Emit status update event so webhook handler auto-triggers
    await publishRequisitionStatusUpdate(createdRequisition.id!, createdRequisition.status || 'approved');

    // Create corresponding headcount plan in Paylocity
    logger.info('createRequisitionHandler:paylocity:createPlan:begin', {
      requisitionId: createdRequisition.id,
    });

    await paylocityClient.createHeadcountPlan({
      requisitionId: createdRequisition.id!,
      department: createdRequisition.department,
      position: createdRequisition.title,
      startDate: new Date().toISOString(),
      status: createdRequisition.status,
      headcount: 1,
      budget: 0,
    });
    // Optionally store plan id if returned
    try {
      const plan = await paylocityClient.getHeadcountPlanByRequisitionId(createdRequisition.id!);
      if (plan?.id) {
        await RequisitionRepository.setHeadcountPlanId(createdRequisition.id!, plan.id);
      }
    } catch {}
    logger.info('createRequisitionHandler:paylocity:createPlan:ok');

    logger.info('createRequisitionHandler:response:begin');
    const response = formatResponse(201, { data: createdRequisition });
    logger.info('createRequisitionHandler:response:ok');
    return response;
  } catch (error) {
    logger.error('createRequisitionHandler:error', { error });

    if (error instanceof ValidationError) {
      logger.info('createRequisitionHandler:error:validation');
      return formatResponse(400, {
        error: {
          message: 'Invalid request body',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    throw error;
  } finally {
    logger.info('createRequisitionHandler:end');
  }
};

export const handler = withMiddleware(createRequisitionHandler, createRequisitionSchema); 