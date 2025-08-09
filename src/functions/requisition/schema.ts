import { z } from 'zod';

export const requisitionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  department: z.string().min(1, 'Department is required'),
  location: z.string().min(1, 'Location is required'),
  employmentType: z.string().min(1, 'Employment type is required'),
  status: z.string().min(1, 'Status is required'),
  customFields: z.record(z.unknown()).optional(),
});

export const createRequisitionSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        department: { type: 'string', minLength: 1 },
        location: { type: 'string', minLength: 1 },
        employmentType: { type: 'string', minLength: 1 },
        status: { type: 'string', minLength: 1 },
        customFields: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['title', 'description', 'department', 'location', 'employmentType', 'status'],
      additionalProperties: false,
    },
  },
  required: ['body'],
};

export const updateRequisitionSchema = {
  type: 'object',
  properties: {
    pathParameters: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 },
      },
      required: ['id'],
    },
    body: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        department: { type: 'string', minLength: 1 },
        location: { type: 'string', minLength: 1 },
        employmentType: { type: 'string', minLength: 1 },
        status: { type: 'string', minLength: 1 },
        customFields: {
          type: 'object',
          additionalProperties: true,
        },
      },
      minProperties: 1,
      additionalProperties: false,
    },
  },
  required: ['pathParameters', 'body'],
}; 