import axios, { AxiosInstance } from 'axios';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import logger from '../common/logger';
import { IntegrationError } from '../common/errors';

interface ApiCredentials {
  clearCompanyApiKey: string;
  paylocityApiKey: string;
}

export interface HeadcountPlan {
  id?: string;
  requisitionId: string;
  department: string;
  position: string;
  startDate: string;
  endDate?: string;
  status: string;
  headcount: number;
  budget: number;
  customFields?: Record<string, unknown>;
}

export class PaylocityClient {
  private readonly client: AxiosInstance;
  private static instance: PaylocityClient;

  private constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: process.env.PAYLOCITY_API_URL || 'https://api.paylocity.com',
      // If using mock API, override the baseURL
      ...(process.env.USE_MOCK_APIS === 'true' && {
        baseURL: process.env.API_ENDPOINT ? `${process.env.API_ENDPOINT}/mock/paylocity` : undefined,
      }),
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  public static async getInstance(): Promise<PaylocityClient> {
    if (!PaylocityClient.instance) {
      const secretsManager = new SecretsManager({});
      const secretName = process.env.API_CREDENTIALS_SECRET_NAME;

      if (!secretName) {
        throw new IntegrationError('API credentials secret name not configured');
      }

      try {
        const secretValue = await secretsManager.getSecretValue({ SecretId: secretName });
        const credentials: ApiCredentials = JSON.parse(secretValue.SecretString || '{}');

        if (!credentials.paylocityApiKey) {
          throw new IntegrationError('Paylocity API key not found in secrets');
        }

        PaylocityClient.instance = new PaylocityClient(credentials.paylocityApiKey);
      } catch (error) {
        logger.error('Failed to initialize Paylocity client', { error });
        throw new IntegrationError('Failed to initialize Paylocity client');
      }
    }

    return PaylocityClient.instance;
  }

  public async createHeadcountPlan(plan: HeadcountPlan): Promise<HeadcountPlan> {
    try {
      const response = await this.client.post<HeadcountPlan>('/v1/headcount-planning', plan);
      return response.data;
    } catch (error) {
      logger.error('Failed to create headcount plan in Paylocity', { error, plan });
      throw new IntegrationError('Failed to create headcount plan in Paylocity');
    }
  }

  public async updateHeadcountPlan(id: string, plan: Partial<HeadcountPlan>): Promise<HeadcountPlan> {
    try {
      const response = await this.client.put<HeadcountPlan>(`/v1/headcount-planning/${id}`, plan);
      return response.data;
    } catch (error) {
      logger.error('Failed to update headcount plan in Paylocity', { error, id, plan });
      throw new IntegrationError('Failed to update headcount plan in Paylocity');
    }
  }

  public async getHeadcountPlan(id: string): Promise<HeadcountPlan> {
    try {
      const response = await this.client.get<HeadcountPlan>(`/v1/headcount-planning/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get headcount plan from Paylocity', { error, id });
      throw new IntegrationError('Failed to get headcount plan from Paylocity');
    }
  }

  public async getHeadcountPlanByRequisitionId(requisitionId: string): Promise<HeadcountPlan> {
    try {
      const response = await this.client.get<HeadcountPlan>(`/v1/headcount-planning/requisition/${requisitionId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get headcount plan by requisition ID from Paylocity', { error, requisitionId });
      throw new IntegrationError('Failed to get headcount plan by requisition ID from Paylocity');
    }
  }
} 