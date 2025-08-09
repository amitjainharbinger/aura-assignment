import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import validator from '@middy/validator';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import logger from './logger';
import { formatError } from './errors';

export type LambdaHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

export interface ResponseBody {
  data?: unknown;
  error?: {
    message: string;
    code?: string;
  };
}

export const formatResponse = (
  statusCode: number,
  body: ResponseBody
): APIGatewayProxyResult => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
  },
});

export const withMiddleware = (
  handler: LambdaHandler,
  schema?: Record<string, unknown>
): middy.MiddyfiedHandler => {
  const middleware = middy(async (event: APIGatewayProxyEvent) => {
    try {
      logger.info('Request received', {
        path: event.path,
        method: event.httpMethod,
        queryParams: event.queryStringParameters,
      });

      const result = await handler(event);

      logger.info('Request completed', {
        path: event.path,
        method: event.httpMethod,
        statusCode: result.statusCode,
      });

      return result;
    } catch (error) {
      logger.error('Request failed', {
        path: event.path,
        method: event.httpMethod,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return formatError(error instanceof Error ? error : new Error('Unknown error'));
    }
  });

  middleware
    .use(httpJsonBodyParser())
    .use(httpErrorHandler())
    .use(
      validator({
        eventSchema: schema,
      })
    );

  return middleware;
}; 