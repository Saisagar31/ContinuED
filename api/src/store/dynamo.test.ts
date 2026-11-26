import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';
import { transferEvent } from '../testkit';
import { dynamoStore, isFirstConditionFailure, type DocSender } from './dynamo';

const T = 'continued-test';
const RECEIVED = new Date('2026-11-20T10:00:00.000Z');

function mock(reply: (cmd: TransactWriteCommand | QueryCommand, i: number) => unknown) {
  const sent: (TransactWriteCommand | QueryCommand)[] = [];
  const client: DocSender = {
    async send(cmd) {
      sent.push(cmd);
      const r = reply(cmd, sent.length);
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { client, sent };
}

const cancelled = (codes: string[]) =>
  new TransactionCanceledException({ message: 'Transaction cancelled', $metadata: {}, CancellationReasons: codes.map((Code) => ({ Code })) });

describe('dynamoStore.putEvent', () => {
  const event = transferEvent({
    eventId: 'ev-dyn-1',
    occurredAt: '2026-03-15T09:00:00Z',
    statuses: { 'num.place_value': 'developing', 'lit.letter_sounds': 'mastered', 'num.addition': 'not_yet' },
  });
  const input = { schoolId: 'S1', district: 'pune', deviceId: 'device-1', event, receivedAt: RECEIVED, retentionDays: 30 };

  it('is one TransactWriteItems: conditional Put first, then counter ADDs, then district membership', async () => {
    const { client, sent } = mock(() => ({}));
    expect(await dynamoStore(T, client).putEvent(input)).toBe('accepted');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(TransactWriteCommand);
    const items = (sent[0] as TransactWriteCommand).input.TransactItems!;
    expect(items).toHaveLength(5);

    const put = items[0].Put!;
    expect(put.TableName).toBe(T);
    expect(put.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(put.Item).toMatchObject({
      PK: 'SCHOOL#S1',
      SK: 'EVENT#ev-dyn-1',
      schoolId: 'S1',
      learner: event.learner,
      deviceId: 'device-1',
      receivedAt: '2026-11-20T10:00:00.000Z',
      expiresAt: Math.floor(RECEIVED.getTime() / 1000) + 30 * 86400,
      aggKeys: ['AGG#2026-03#CORRIDOR#mr>kn', 'AGG#2026-03#SKILL#mr#num.place_value', 'AGG#2026-03#SKILL#mr#num.addition'],
    });

    expect(items.slice(1, 4).map((i) => i.Update)).toEqual(
      ['AGG#2026-03#CORRIDOR#mr>kn', 'AGG#2026-03#SKILL#mr#num.place_value', 'AGG#2026-03#SKILL#mr#num.addition'].map((SK) => ({
        TableName: T,
        Key: { PK: 'SCHOOL#S1', SK },
        UpdateExpression: 'ADD #n :d',
        ExpressionAttributeNames: { '#n': 'n' },
        ExpressionAttributeValues: { ':d': 1 },
      })),
    );
    expect(items[4]).toEqual({ Put: { TableName: T, Item: { PK: 'DISTRICT#pune', SK: 'SCHOOL#S1' } } });
  });

  it('assessment events store the item but touch no counters; no district → no membership Put', async () => {
    const { client, sent } = mock(() => ({}));
    await dynamoStore(T, client).putEvent({ ...input, district: undefined, event: { ...event, type: 'assessment_completed', destLang: undefined } });
    const items = (sent[0] as TransactWriteCommand).input.TransactItems!;
    expect(items).toHaveLength(1);
    expect(items[0].Put!.Item!.aggKeys).toEqual([]);
  });

  it('TransactionCanceledException with ConditionalCheckFailed first → duplicate', async () => {
    const { client } = mock(() => cancelled(['ConditionalCheckFailed', 'None', 'None']));
    expect(await dynamoStore(T, client).putEvent(input)).toBe('duplicate');
  });

  it('other cancellations and errors are rethrown (route answers 500, client retries)', async () => {
    for (const err of [cancelled(['None', 'TransactionConflict']), cancelled(['TransactionConflict']), new Error('throttled')]) {
      const { client } = mock(() => err);
      await expect(dynamoStore(T, client).putEvent(input)).rejects.toBe(err);
    }
    expect(isFirstConditionFailure(cancelled(['None', 'ConditionalCheckFailed']))).toBe(false);
  });
});

describe('dynamoStore reads and deletes', () => {
  it('readCounters queries the AGG month range with pagination and drops zero counters', async () => {
    const { client, sent } = mock((_c, i) =>
      i === 1
        ? { Items: [{ PK: 'SCHOOL#S1', SK: 'AGG#2026-03#CORRIDOR#mr>kn', n: 6 }], LastEvaluatedKey: { PK: 'SCHOOL#S1', SK: 'x' } }
        : { Items: [{ PK: 'SCHOOL#S1', SK: 'AGG#2026-04#SKILL#mr#num.place_value', n: 2 }, { PK: 'SCHOOL#S1', SK: 'AGG#2026-04#SKILL#mr#num.addition', n: 0 }] },
    );
    const out = await dynamoStore(T, client).readCounters('S1', '2026-01', '2026-12');
    expect(out).toEqual([
      { schoolId: 'S1', month: '2026-03', dimension: 'CORRIDOR', key: 'mr>kn', n: 6 },
      { schoolId: 'S1', month: '2026-04', dimension: 'SKILL', key: 'mr#num.place_value', n: 2 },
    ]);
    expect(sent).toHaveLength(2);
    const q = (sent[0] as QueryCommand).input;
    expect(q).toMatchObject({
      TableName: T,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :lo AND :hi',
      ExpressionAttributeValues: { ':pk': 'SCHOOL#S1', ':lo': 'AGG#2026-01', ':hi': 'AGG#2026-12#￿' },
    });
    expect((sent[1] as QueryCommand).input.ExclusiveStartKey).toEqual({ PK: 'SCHOOL#S1', SK: 'x' });
  });

  it('schoolsInDistrict queries the district partition', async () => {
    const { client, sent } = mock(() => ({ Items: [{ PK: 'DISTRICT#pune', SK: 'SCHOOL#S1' }, { PK: 'DISTRICT#pune', SK: 'SCHOOL#S2' }] }));
    expect(await dynamoStore(T, client).schoolsInDistrict('pune')).toEqual(['S1', 'S2']);
    expect((sent[0] as QueryCommand).input.ExpressionAttributeValues).toEqual({ ':pk': 'DISTRICT#pune' });
  });

  it('deleteLearner: one transaction per event (conditional Delete + counter decrements), skips concurrent deletes', async () => {
    const { client, sent } = mock((cmd, i) => {
      if (cmd instanceof QueryCommand) return { Items: [{ SK: 'EVENT#e1', aggKeys: ['AGG#2026-03#CORRIDOR#mr>kn'] }, { SK: 'EVENT#e2', aggKeys: [] }] };
      return i === 3 ? cancelled(['ConditionalCheckFailed']) : {};
    });
    expect(await dynamoStore(T, client).deleteLearner('S1', 'L-0001')).toBe(1);
    const q = (sent[0] as QueryCommand).input;
    expect(q).toMatchObject({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :ev)',
      FilterExpression: '#l = :l',
      ExpressionAttributeValues: { ':pk': 'SCHOOL#S1', ':ev': 'EVENT#', ':l': 'L-0001' },
    });
    expect((sent[1] as TransactWriteCommand).input.TransactItems).toEqual([
      { Delete: { TableName: T, Key: { PK: 'SCHOOL#S1', SK: 'EVENT#e1' }, ConditionExpression: 'attribute_exists(PK)' } },
      {
        Update: {
          TableName: T,
          Key: { PK: 'SCHOOL#S1', SK: 'AGG#2026-03#CORRIDOR#mr>kn' },
          UpdateExpression: 'ADD #n :d',
          ExpressionAttributeNames: { '#n': 'n' },
          ExpressionAttributeValues: { ':d': -1 },
        },
      },
    ]);
  });
});
