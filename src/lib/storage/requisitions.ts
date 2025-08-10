// File: src/lib/storage/requisitions.ts
// Purpose: DynamoDB persistence for requisitions and related state

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

export interface RequisitionRecord {
  id: string;
  title: string;
  description: string;
  department: string;
  location: string;
  employmentType: string;
  status: string;
  salary?: { min: number; max: number; currency: string };
  requirements?: string[];
  benefits?: string[];
  headcountPlanId?: string;
  createdAt: string;
  updatedAt: string;
}

export class RequisitionRepository {
  private static _doc: DynamoDBDocumentClient;
  private static get client(): DynamoDBDocumentClient {
    if (!this._doc) {
      const ddb = new DynamoDBClient({});
      this._doc = DynamoDBDocumentClient.from(ddb, { marshallOptions: { removeUndefinedValues: true } });
    }
    return this._doc;
  }

  private static get tableName(): string {
    const name = process.env.INTEGRATION_STATE_TABLE;
    if (!name) throw new Error('INTEGRATION_STATE_TABLE not set');
    return String(name);
  }

  public static async put(item: RequisitionRecord): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item }));
  }

  public static async get(id: string): Promise<RequisitionRecord | undefined> {
    const out = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { id } }));
    return out.Item as RequisitionRecord | undefined;
  }

  public static async updateFields(id: string, fields: Partial<RequisitionRecord>): Promise<void> {
    const expressions: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};
    let i = 0;
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      const nk = `#k${i}`;
      const nv = `:v${i}`;
      names[nk] = k;
      values[nv] = v;
      expressions.push(`${nk} = ${nv}`);
      i++;
    }
    if (expressions.length === 0) return;
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );
  }

  public static async setHeadcountPlanId(id: string, headcountPlanId: string): Promise<void> {
    await this.updateFields(id, { headcountPlanId, updatedAt: new Date().toISOString() });
  }

  public static async updateStatus(id: string, status: string): Promise<void> {
    await this.updateFields(id, { status, updatedAt: new Date().toISOString() });
  }
}
