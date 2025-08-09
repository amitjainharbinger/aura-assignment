import axios, { AxiosInstance } from 'axios';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import logger from '../common/logger';
import { IntegrationError } from '../common/errors';

interface ApiCredentials {
  clearCompanyApiKey: string;
  paylocityApiKey: string;
}

export interface Requisition {
  id?: string;
  title: string;
  description: string;
  department: string;
  location: string;
  employmentType: string;
  status: string;
  customFields?: Record<string, unknown>;
}

export class ClearCompanyClient {
  private readonly client: AxiosInstance;
  private static instance: ClearCompanyClient;

  private constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: process.env.CLEARCOMPANY_API_URL || 'https://api.clearcompany.com',
      // If using mock API, override the baseURL
      ...(process.env.USE_MOCK_APIS === 'true' && {
        baseURL: process.env.API_ENDPOINT ? `${process.env.API_ENDPOINT}/mock/clearcompany` : undefined,
      }),
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  public static async getInstance(): Promise<ClearCompanyClient> {
    if (!ClearCompanyClient.instance) {
      const secretsManager = new SecretsManager({});
      const secretName = process.env.API_CREDENTIALS_SECRET_NAME;

      if (!secretName) {
        throw new IntegrationError('API credentials secret name not configured');
      }

      try {
        const secretValue = await secretsManager.getSecretValue({ SecretId: secretName });
        const credentials: ApiCredentials = JSON.parse(secretValue.SecretString || '{}');

        if (!credentials.clearCompanyApiKey) {
          throw new IntegrationError('ClearCompany API key not found in secrets');
        }

        ClearCompanyClient.instance = new ClearCompanyClient(credentials.clearCompanyApiKey);
      } catch (error) {
        logger.error('Failed to initialize ClearCompany client', { error });
        throw new IntegrationError('Failed to initialize ClearCompany client');
      }
    }

    return ClearCompanyClient.instance;
  }

  public async createRequisition(requisition: Requisition): Promise<Requisition> {
    try {
      const response = await this.client.post<Requisition>('/v1/requisitions', requisition);
      return response.data;
    } catch (error) {
      logger.error('Failed to create requisition in ClearCompany', { error, requisition });
      throw new IntegrationError('Failed to create requisition in ClearCompany');
    }
  }

  public async updateRequisition(id: string, requisition: Partial<Requisition>): Promise<Requisition> {
    try {
      const response = await this.client.put<Requisition>(`/v1/requisitions/${id}`, requisition);
      return response.data;
    } catch (error) {
      logger.error('Failed to update requisition in ClearCompany', { error, id, requisition });
      throw new IntegrationError('Failed to update requisition in ClearCompany');
    }
  }

  public async getRequisition(id: string): Promise<Requisition> {
    try {
      const response = await this.client.get<Requisition>(`/v1/requisitions/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get requisition from ClearCompany', { error, id });
      throw new IntegrationError('Failed to get requisition from ClearCompany');
    }
  }
} 