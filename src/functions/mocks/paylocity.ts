import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { EventBridge } from '@aws-sdk/client-eventbridge';

const dynamoDb = DynamoDBDocument.from(new DynamoDB({}));
const eventBridge = new EventBridge({});
const TABLE_NAME = 'mock-paylocity-data';

interface HeadcountPlan {
  id: string;
  requisitionId: string;
  department: string;
  position: string;
  startDate: string;
  endDate?: string;
  status: string;
  headcount: number;
  budget: number;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const sendEvent = async (detail: unknown): Promise<void> => {
  if (!process.env.EVENT_BUS_NAME) {
    console.warn('EVENT_BUS_NAME not set, skipping event');
    return;
  }

  await eventBridge.putEvents({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_NAME,
      Source: 'mock.paylocity',
      DetailType: 'MockPaylocityEvent',
      Detail: JSON.stringify(detail),
    }],
  });
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, path, body } = event;
    const pathSegments = path.split('/');
    const planId = pathSegments[pathSegments.length - 1];

    // Common response headers
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    };

    switch (httpMethod) {
      case 'POST': {
        // Create headcount plan
        const planData = JSON.parse(body || '{}');
        const plan: HeadcountPlan = {
          id: Math.random().toString(36).substring(2, 15),
          ...planData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await dynamoDb.put({
          TableName: TABLE_NAME,
          Item: plan,
        });

        // Send event
        await sendEvent({
          type: 'headcount_plan',
          entityId: plan.id,
          action: 'created',
          data: plan,
        });

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(plan),
        };
      }

      case 'PUT': {
        // Update headcount plan
        const updateData = JSON.parse(body || '{}');
        
        // Get existing plan
        const existingPlan = await dynamoDb.get({
          TableName: TABLE_NAME,
          Key: { id: planId },
        });

        if (!existingPlan.Item) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Headcount plan not found' }),
          };
        }

        const updatedPlan: HeadcountPlan = {
          ...existingPlan.Item as HeadcountPlan,
          ...updateData,
          updatedAt: new Date().toISOString(),
        };

        await dynamoDb.put({
          TableName: TABLE_NAME,
          Item: updatedPlan,
        });

        // Send event for status update
        if (updateData.status) {
          await sendEvent({
            type: 'headcount_plan',
            entityId: planId,
            action: 'status_updated',
            data: { status: updateData.status },
          });
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updatedPlan),
        };
      }

      case 'GET': {
        // Check if this is a search by requisitionId
        if (path.includes('/requisition/')) {
          const requisitionId = planId; // In this case, planId is actually the requisitionId
          
          // Query by requisitionId
          const result = await dynamoDb.query({
            TableName: TABLE_NAME,
            IndexName: 'requisitionId-index',
            KeyConditionExpression: 'requisitionId = :requisitionId',
            ExpressionAttributeValues: {
              ':requisitionId': requisitionId,
            },
          });

          if (!result.Items || result.Items.length === 0) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Headcount plan not found' }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Items[0]),
          };
        }

        // Get plan by ID
        const result = await dynamoDb.get({
          TableName: TABLE_NAME,
          Key: { id: planId },
        });

        if (!result.Item) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Headcount plan not found' }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result.Item),
        };
      }

      case 'DELETE': {
        // Delete headcount plan
        await dynamoDb.delete({
          TableName: TABLE_NAME,
          Key: { id: planId },
        });

        return {
          statusCode: 204,
          headers,
          body: '',
        };
      }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};