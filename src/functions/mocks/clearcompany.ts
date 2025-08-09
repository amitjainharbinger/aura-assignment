import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { EventBridge } from '@aws-sdk/client-eventbridge';

const dynamoDb = DynamoDBDocument.from(new DynamoDB({}));
const eventBridge = new EventBridge({});
const TABLE_NAME = 'mock-clearcompany-data';

interface Requisition {
  id: string;
  title: string;
  description: string;
  department: string;
  location: string;
  employmentType: string;
  status: string;
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
      Source: 'mock.clearcompany',
      DetailType: 'MockClearCompanyEvent',
      Detail: JSON.stringify(detail),
    }],
  });
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, path, body } = event;
    const pathSegments = path.split('/');
    const requisitionId = pathSegments[pathSegments.length - 1];

    // Common response headers
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    };

    switch (httpMethod) {
      case 'POST': {
        // Create requisition
        const requisitionData = JSON.parse(body || '{}');
        const requisition: Requisition = {
          id: Math.random().toString(36).substring(2, 15),
          ...requisitionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await dynamoDb.put({
          TableName: TABLE_NAME,
          Item: requisition,
        });

        // Send event
        await sendEvent({
          type: 'requisition',
          entityId: requisition.id,
          action: 'created',
          data: requisition,
        });

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(requisition),
        };
      }

      case 'PUT': {
        // Update requisition
        const updateData = JSON.parse(body || '{}');
        
        // Get existing requisition
        const existingRequisition = await dynamoDb.get({
          TableName: TABLE_NAME,
          Key: { id: requisitionId },
        });

        if (!existingRequisition.Item) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Requisition not found' }),
          };
        }

        const updatedRequisition: Requisition = {
          ...existingRequisition.Item as Requisition,
          ...updateData,
          updatedAt: new Date().toISOString(),
        };

        await dynamoDb.put({
          TableName: TABLE_NAME,
          Item: updatedRequisition,
        });

        // Send event for status update
        if (updateData.status) {
          await sendEvent({
            type: 'requisition',
            entityId: requisitionId,
            action: 'status_updated',
            data: { status: updateData.status },
          });
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updatedRequisition),
        };
      }

      case 'GET': {
        // Get requisition
        const result = await dynamoDb.get({
          TableName: TABLE_NAME,
          Key: { id: requisitionId },
        });

        if (!result.Item) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Requisition not found' }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result.Item),
        };
      }

      case 'DELETE': {
        // Delete requisition
        await dynamoDb.delete({
          TableName: TABLE_NAME,
          Key: { id: requisitionId },
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