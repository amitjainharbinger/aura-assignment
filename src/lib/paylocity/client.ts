import axios, { AxiosInstance } from 'axios';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import logger from '../common/logger';
import { IntegrationError } from '../common/errors';

export interface HeadcountPlan {
  requisitionId: string;
  department: string;
  position: string;
  startDate: string;
  status: string;
  headcount: number;
  budget: number;
}

export class PaylocityClient {
  private static instance: PaylocityClient;
  private client: AxiosInstance;

  private constructor(apiKey: string) {
    const baseURL = process.env.PAYLOCITY_API_URL || 'https://api.paylocity.com';

    logger.info('Initializing Paylocity client', { baseURL });

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  public static async getInstance(): Promise<PaylocityClient> {
    if (!PaylocityClient.instance) {
      if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
        PaylocityClient.instance = new PaylocityClient('mock-key');
        return PaylocityClient.instance;
      }

      const secretsManager = new SecretsManager({});
      const secretArn = process.env.API_CREDENTIALS_SECRET_ARN;

      if (!secretArn) {
        throw new IntegrationError('API credentials secret ARN not configured');
      }

      try {
        const secretValue = await secretsManager.getSecretValue({ SecretId: secretArn });
        const credentials = JSON.parse(secretValue.SecretString || '{}');

        const apiKey = credentials.paylocityApiKey || process.env.PAYLOCITY_API_KEY;
        if (!apiKey) {
          throw new IntegrationError('Paylocity API key not found');
        }

        PaylocityClient.instance = new PaylocityClient(apiKey);
      } catch (error) {
        logger.error('Failed to initialize Paylocity client', { error });
        throw new IntegrationError('Failed to initialize Paylocity client');
      }
    }

    return PaylocityClient.instance;
  }

  public async createHeadcountPlan(plan: HeadcountPlan): Promise<any> {
    if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
      logger.info('DRY_RUN enabled: returning stub for createHeadcountPlan');
      return { id: 'plan-' + plan.requisitionId, ...plan };
    }

    try {
      const response = await this.client.post('/v1/headcount-plans', plan);
      return response.data;
    } catch (error) {
      logger.error('Failed to create headcount plan in Paylocity', { error, plan });
      throw new IntegrationError('Failed to create headcount plan in Paylocity');
    }
  }

  public async updateHeadcountPlan(id: string, plan: Partial<HeadcountPlan>): Promise<any> {
    if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
      logger.info('DRY_RUN enabled: returning stub for updateHeadcountPlan');
      return { id, ...plan };
    }

    try {
      const response = await this.client.put(`/v1/headcount-plans/${id}`, plan);
      return response.data;
    } catch (error) {
      logger.error('Failed to update headcount plan in Paylocity', { error, id, plan });
      throw new IntegrationError('Failed to update headcount plan in Paylocity');
    }
  }

  public async getHeadcountPlan(id: string): Promise<any> {
    if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
      logger.info('DRY_RUN enabled: returning stub for getHeadcountPlan');
      return { id };
    }

    try {
      const response = await this.client.get(`/v1/headcount-plans/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get headcount plan from Paylocity', { error, id });
      throw new IntegrationError('Failed to get headcount plan from Paylocity');
    }
  }

  public async getHeadcountPlanByRequisitionId(requisitionId: string): Promise<any> {
    if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
      logger.info('DRY_RUN enabled: returning stub for getHeadcountPlanByRequisitionId');
      return { id: 'plan-' + requisitionId, requisitionId };
    }

    try {
      const response = await this.client.get(`/v1/headcount-plans/requisition/${requisitionId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get headcount plan by requisition ID from Paylocity', { error, requisitionId });
      throw new IntegrationError('Failed to get headcount plan by requisition ID from Paylocity');
    }
  }
}