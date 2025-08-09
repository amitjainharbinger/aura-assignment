import axios, { AxiosInstance } from 'axios';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import logger from '../common/logger';
import { IntegrationError } from '../common/errors';

export interface Requisition {
  title: string;
  description: string;
  department: string;
  location: string;
  employmentType: string;
  status: string;
  salary?: {
    min: number;
    max: number;
    currency: string;
  };
  customFields?: Record<string, unknown>;
}

export class ClearCompanyClient {
  private static instance: ClearCompanyClient;
  private client: AxiosInstance;

  private constructor(apiKey: string) {
    const baseURL = process.env.CLEARCOMPANY_API_URL || 'https://api.clearcompany.com';

    logger.info('Initializing ClearCompany client', { baseURL });

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  public static async getInstance(): Promise<ClearCompanyClient> {
    if (!ClearCompanyClient.instance) {
      // Bypass secrets on DRY_RUN
      if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
        ClearCompanyClient.instance = new ClearCompanyClient('mock-key');
        return ClearCompanyClient.instance;
      }

      const secretsManager = new SecretsManager({});
      const secretArn = process.env.API_CREDENTIALS_SECRET_ARN;

      if (!secretArn) {
        throw new IntegrationError('API credentials secret ARN not configured');
      }

      try {
        const secretValue = await secretsManager.getSecretValue({ SecretId: secretArn });
        const credentials = JSON.parse(secretValue.SecretString || '{}');

        const apiKey = credentials.clearCompanyApiKey || process.env.CLEARCOMPANY_API_KEY;
        if (!apiKey) {
          throw new IntegrationError('ClearCompany API key not found');
        }

        ClearCompanyClient.instance = new ClearCompanyClient(apiKey);
      } catch (error) {
        logger.error('Failed to initialize ClearCompany client', { error });
        throw new IntegrationError('Failed to initialize ClearCompany client');
      }
    }

    return ClearCompanyClient.instance;
  }

  public async createRequisition(requisition: Requisition): Promise<any> {
    if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
      logger.info('DRY_RUN enabled: returning stub for createRequisition');
      return { id: requisition['id'] || undefined, ...requisition };
    }

    try {
      const response = await this.client.post('/v1/requisitions', requisition);
      return response.data;
    } catch (error) {
      logger.error('Failed to create requisition in ClearCompany', { error, requisition });
      throw new IntegrationError('Failed to create requisition in ClearCompany');
    }
  }

  public async updateRequisition(id: string, requisition: Partial<Requisition>): Promise<any> {
    if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
      logger.info('DRY_RUN enabled: returning stub for updateRequisition');
      return { id, ...requisition };
    }

    try {
      const response = await this.client.put(`/v1/requisitions/${id}`, requisition);
      return response.data;
    } catch (error) {
      logger.error('Failed to update requisition in ClearCompany', { error, id, requisition });
      throw new IntegrationError('Failed to update requisition in ClearCompany');
    }
  }

  public async getRequisition(id: string): Promise<any> {
    if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
      logger.info('DRY_RUN enabled: returning stub for getRequisition');
      return { id, title: 'Stubbed Requisition', status: 'open' };
    }

    try {
      const response = await this.client.get(`/v1/requisitions/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get requisition from ClearCompany', { error, id });
      throw new IntegrationError('Failed to get requisition from ClearCompany');
    }
  }
}