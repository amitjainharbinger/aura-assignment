import middy from '@middy/core';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import validator from '@middy/validator';
import { transpileSchema } from '@middy/validator/transpile';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export type LambdaHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

export interface ResponseBody {
  data?: any;
  error?: {
    message: string;
    code: string;
  };
}

export const formatResponse = (statusCode: number, body: ResponseBody): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
  },
  body: JSON.stringify(body),
});

export const withMiddleware = (handler: LambdaHandler, eventSchema: any): middy.MiddyfiedHandler => {
  return middy(handler)
    .use(jsonBodyParser())
    .use(validator({ eventSchema: transpileSchema(eventSchema) }))
    .use(httpErrorHandler());
};