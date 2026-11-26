/**
 * DynamoDB SchoolStore (task 11). Key layout and semantics: see types.ts.
 *
 * IAM actions used (and the only ones the Lambda role grants): PutItem, UpdateItem,
 * DeleteItem and ConditionCheckItem (inside TransactWriteItems), TransactWriteItems, Query.
 * No Scan and no GetItem.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import {
  counterKeysFor,
  districtPk,
  eventSk,
  expiresAtFor,
  parseCounterSk,
  schoolPk,
  storedEventFields,
  type Counter,
  type PutEventInput,
  type PutResult,
  type SchoolStore,
} from './types';

/** The subset of DynamoDBDocumentClient we use; tests pass a mock. */
export interface DocSender {
  send(command: TransactWriteCommand | QueryCommand): Promise<unknown>;
}

type TransactItems = NonNullable<TransactWriteCommand['input']['TransactItems']>;

/** True when a transaction was cancelled because its FIRST item's condition failed. */
export function isFirstConditionFailure(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { name?: string; CancellationReasons?: { Code?: string }[] };
  return err.name === 'TransactionCanceledException' && err.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed';
}

const counterUpdate = (table: string, pk: string, sk: string, delta: number): TransactItems[number] => ({
  Update: {
    TableName: table,
    Key: { PK: pk, SK: sk },
    UpdateExpression: 'ADD #n :d',
    ExpressionAttributeNames: { '#n': 'n' },
    ExpressionAttributeValues: { ':d': delta },
  },
});

/** Builds the single TransactWriteItems input that accepts one event. Exported for tests. */
export function putEventTransaction(table: string, input: PutEventInput): TransactItems {
  const pk = schoolPk(input.schoolId);
  const aggKeys = counterKeysFor(input.event);
  const items: TransactItems = [
    {
      Put: {
        TableName: table,
        Item: {
          PK: pk,
          SK: eventSk(input.event.eventId),
          ...storedEventFields(input.event),
          schoolId: input.schoolId,
          deviceId: input.deviceId,
          receivedAt: input.receivedAt.toISOString(),
          expiresAt: expiresAtFor(input.receivedAt, input.retentionDays),
          aggKeys,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
    ...aggKeys.map((sk) => counterUpdate(table, pk, sk, 1)),
  ];
  if (input.district) items.push({ Put: { TableName: table, Item: { PK: districtPk(input.district), SK: pk } } });
  return items;
}

async function queryAll(client: DocSender, input: QueryCommand['input']): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = (await client.send(new QueryCommand({ ...input, ExclusiveStartKey: start }))) as {
      Items?: Record<string, unknown>[];
      LastEvaluatedKey?: Record<string, unknown>;
    };
    out.push(...(res.Items ?? []));
    start = res.LastEvaluatedKey;
  } while (start);
  return out;
}

export function dynamoStore(tableName: string, client: DocSender = DynamoDBDocumentClient.from(new DynamoDBClient({}))): SchoolStore {
  return {
    async putEvent(input): Promise<PutResult> {
      try {
        await client.send(new TransactWriteCommand({ TransactItems: putEventTransaction(tableName, input) }));
        return 'accepted';
      } catch (e) {
        if (isFirstConditionFailure(e)) return 'duplicate';
        throw e; // conflicts/throttling: the route returns 500 and the client retries the batch
      }
    },

    async readCounters(schoolId, fromMonth, toMonth): Promise<Counter[]> {
      const items = await queryAll(client, {
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND SK BETWEEN :lo AND :hi',
        ExpressionAttributeValues: { ':pk': schoolPk(schoolId), ':lo': `AGG#${fromMonth}`, ':hi': `AGG#${toMonth}#￿` },
      });
      return items
        .map((i) => parseCounterSk(schoolId, i.SK as string, Number(i.n ?? 0)))
        .filter((c): c is Counter => c !== null && c.n !== 0);
    },

    async schoolsInDistrict(district) {
      const items = await queryAll(client, {
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': districtPk(district) },
      });
      return items.map((i) => (i.SK as string).slice('SCHOOL#'.length));
    },

    async deleteLearner(schoolId, learner) {
      const pk = schoolPk(schoolId);
      // Reads the school's event partition with a filter. Fine at pilot scale; a
      // learner GSI would make this cheaper for large schools.
      const events = await queryAll(client, {
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :ev)',
        FilterExpression: '#l = :l',
        ProjectionExpression: 'SK, aggKeys',
        ExpressionAttributeNames: { '#l': 'learner' },
        ExpressionAttributeValues: { ':pk': pk, ':ev': 'EVENT#', ':l': learner },
      });
      let deleted = 0;
      for (const ev of events) {
        const aggKeys = (ev.aggKeys as string[] | undefined) ?? [];
        try {
          await client.send(
            new TransactWriteCommand({
              TransactItems: [
                { Delete: { TableName: tableName, Key: { PK: pk, SK: ev.SK as string }, ConditionExpression: 'attribute_exists(PK)' } },
                ...aggKeys.map((sk) => counterUpdate(tableName, pk, sk, -1)),
              ],
            }),
          );
          deleted++;
        } catch (e) {
          if (!isFirstConditionFailure(e)) throw e; // already deleted by a concurrent request
        }
      }
      return deleted;
    },
  };
}
