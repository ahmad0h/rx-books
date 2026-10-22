import { readFileSync } from 'node:fs';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AI_NOT_SET_UP, NOTHING_FOR_AI } from '../src/ai/ai.service.js';
import type { ClassifyRequest } from '../src/ai/claude.client.js';
import { DEMO_RULES } from '../src/demo/demo-rules.js';
import {
  createTestApp,
  type FakeClaude,
  type InMemoryCoaRepository,
  type InMemoryRuleRepository,
  type InMemoryUserRepository,
} from './test-app.js';

interface Row {
  id: number;
  description: string;
  amount: string;
  coaCode: string;
  status: string;
  source: string | null;
  aiConfidence: number | null;
  aiRationale: string | null;
  subtag: string | null;
  subtagNote: string | null;
}

const coaRow = (code: string, name: string, type: string) => ({
  code,
  name,
  type: type as 'asset',
  expenseGroup: null,
  description: null,
  ownerLabel: null,
  contraOf: null,
  categorizable: true,
  isActive: true,
});

/** The ids and descriptions in a request, read back from its JSON lines. */
const sentRows = (req: ClassifyRequest) =>
  req.user
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map(
      (line) =>
        JSON.parse(line) as { id: number; description: string; amount: string },
    );

/** Answers like a sensible bookkeeper would, plus two answers that must be ignored. */
const bookkeeper = (req: ClassifyRequest) => {
  const suggestions = sentRows(req).map((r) => {
    if (r.description.includes('TRANSFER TO ACCOUNT')) {
      return {
        id: r.id,
        category: '2510',
        confidence: 72,
        rationale: "Transfer to an account that is not the pharmacy's",
        subtag: 'distribution',
        subtag_note: 'Owner transfer',
      };
    }
    if (r.description === 'CHECK' && r.amount === '-2800.00') {
      return {
        id: r.id,
        category: '1015',
        confidence: 55,
        rationale: 'Round cash amount: likely a counter withdrawal',
        subtag: 'none',
        subtag_note: '',
      };
    }
    if (r.description === 'CHECK') {
      return {
        id: r.id,
        category: 'ABCD',
        confidence: 90,
        rationale: 'invalid code',
        subtag: 'none',
        subtag_note: '',
      };
    }
    return {
      id: r.id,
      category: '9999',
      confidence: 20,
      rationale: 'Payment to a person: needs the owner',
      subtag: 'none',
      subtag_note: '',
    };
  });
  suggestions.push({
    id: 999_999,
    category: '6110',
    confidence: 99,
    rationale: 'not sent',
    subtag: 'none',
    subtag_note: '',
  });
  return {
    text: JSON.stringify({ suggestions }),
    model: 'claude-opus-5-5',
    usage: { input: 1000, output: 500, cacheWrite: 4000, cacheRead: 0 },
  };
};

describe('AI suggestions (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;
  let coa: InMemoryCoaRepository;
  let rules: InMemoryRuleRepository;
  let claude: FakeClaude;
  let adminCookie: string;
  let clientCookie: string;
  let pharmacyId: number;
  let ip = 0;

  const signIn = async (email: string, password: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', `10.8.0.${++ip}`)
        .send({ email, password })
        .expect(200)
    ).headers['set-cookie']![0].split(';')[0];
  const as = (cookie: string) => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Cookie', cookie),
    post: (url: string, body: object) =>
      request(app.getHttpServer())
        .post(url)
        .set('Cookie', cookie)
        .set('X-Forwarded-For', `10.8.1.${++ip}`)
        .send(body),
    put: (url: string, body: object) =>
      request(app.getHttpServer()).put(url).set('Cookie', cookie).send(body),
  });
  const admin = () => as(adminCookie);
  const base = () => `/api/pharmacies/${pharmacyId}`;
  const january = async () =>
    (
      (await admin().get(`${base()}/transactions?month=2025-01`).expect(200))
        .body as { transactions: Row[] }
    ).transactions;
  const find = async (text: string) =>
    (await january()).filter((t) => t.description.includes(text));
  const ask = (ids: number[]) =>
    admin().post(`${base()}/transactions/ai`, { ids });

  beforeAll(async () => {
    ({ app, users, coa, rules, claude } = await createTestApp());
    for (const [code, name, type] of [
      ['1010', 'Cash — checking 1', 'asset'],
      ['1015', 'Cash on Hand', 'asset'],
      ['2510', 'Owner draw / personal', 'equity'],
      ['5010', 'Rx drugs — wholesale', 'cost_of_goods'],
      ['6010', 'Wages & salaries', 'expense'],
      ['6110', 'Rent', 'expense'],
      ['9999', 'Uncategorized — needs review', 'review'],
    ]) {
      coa.add(coaRow(code, name, type));
    }
    await users.add({
      email: 'admin@rxbooks.test',
      password: 'admin-password-123',
      name: 'Demo Admin',
      role: 'admin',
    });
    await users.add({
      email: 'client@rxbooks.test',
      password: 'client-password-123',
      name: 'Client',
      role: 'client',
    });
    adminCookie = await signIn('admin@rxbooks.test', 'admin-password-123');
    clientCookie = await signIn('client@rxbooks.test', 'client-password-123');
    pharmacyId = (
      (
        await admin()
          .post('/api/pharmacies', {
            name: 'Lakeside Community Pharmacy',
            ownerName: 'Owner',
            ownerPhone: '(612) 555-0142',
            ownerEmail: 'owner@lakeside.test',
          })
          .expect(201)
      ).body as { id: number }
    ).id;
    for (const rule of DEMO_RULES) {
      rules.add({
        pharmacyId,
        keyword: rule.keyword,
        coaCode: rule.coaCode,
        tag: null,
        priority: rule.priority!,
        autoApprove: rule.autoApprove,
        source: 'manual',
        sourceNote: null,
        retiredAt: null,
      });
    }
    rules.add({
      pharmacyId: null,
      keyword: 'MCKESSON',
      coaCode: '5010',
      tag: null,
      priority: 10,
      autoApprove: true,
      source: 'import',
      sourceNote: null,
      retiredAt: null,
    });
    const checking = (
      (
        await admin()
          .post(`${base()}/accounts`, {
            name: 'Main checking',
            kind: 'checking',
            bank: 'US Bank',
            lastFour: '4821',
            coaCode: '1010',
            openedOn: null,
            closedOn: null,
            notes: null,
          })
          .expect(201)
      ).body as { id: number }
    ).id;
    await admin()
      .post(`${base()}/uploads`, {
        accountId: checking,
        fileName: 'jan.csv',
        content: readFileSync(
          new URL(
            './fixtures/demo_usbank_checking_2025-01.csv',
            import.meta.url,
          ),
          'utf8',
        ),
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports whether AI is set up', async () => {
    const res = await admin().get('/api/ai/status').expect(200);
    expect(res.body).toEqual({
      enabled: true,
      model: 'claude-opus-5-5',
      promptVersion: 1,
    });
    await as(clientCookie).get('/api/ai/status').expect(403);
    await as(clientCookie)
      .post(`${base()}/transactions/ai`, { ids: [1] })
      .expect(403);
  });

  it('refuses to run without an API key', async () => {
    claude.enabled = false;
    const [zelle] = await find('ZELLE');
    const res = await ask([zelle.id]).expect(503);
    expect(res.body.message).toBe(AI_NOT_SET_UP);
    claude.enabled = true;
    expect(claude.calls).toHaveLength(0);
  });

  it('sends only the chosen rows that are uncategorized, and never approves', async () => {
    claude.respond = bookkeeper;
    const ids = [
      ...(await find('ZELLE')),
      ...(await find('CHECK')),
      ...(await find('TRANSFER TO ACCOUNT')),
      ...(await find('MCKESSON')).slice(0, 1), // approved by a rule: skipped
      ...(await find('GUSTO')), // suggested by a rule: skipped
    ].map((t) => t.id);

    const res = await ask(ids).expect(200);
    expect(res.body).toMatchObject({
      sent: 4,
      skipped: 2,
      suggested: 2, // the transfer and the counter withdrawal
      unplaced: 2, // Zelle (AI said 9999) and the check with an invalid code
      batches: 1,
      batchesFailed: 0,
      error: null,
      costUsd: '0.0340', // (1000×$4 + 500×$20 + 4000×$5) per million tokens
    });

    // What Claude saw: the instructions, the chart, our accounts, and only those 4 rows.
    const [call] = claude.calls;
    expect(call.system).toContain('TEST INSTRUCTIONS');
    expect(call.system).toContain('2510 · Owner draw / personal');
    expect(call.system).not.toContain('9999 · Uncategorized — needs review');
    expect(call.user).toContain('Main checking, US Bank ending 4821');
    expect(
      sentRows(call)
        .map((r) => r.description)
        .sort(),
    ).toEqual([
      'CHECK',
      'CHECK',
      'MOBILE BANKING TRANSFER TO ACCOUNT 000000009911',
      'ZELLE INSTANT PMT TO JORDAN LEE',
    ]);

    const [transfer] = await find('TRANSFER TO ACCOUNT');
    expect(transfer).toMatchObject({
      coaCode: '2510',
      status: 'suggested',
      source: 'ai',
      aiConfidence: 72,
      subtag: 'distribution',
      subtagNote: 'Owner transfer',
    });
    const [zelle] = await find('ZELLE');
    expect(zelle).toMatchObject({
      coaCode: '9999',
      status: 'uncategorized',
      source: null,
      aiRationale: 'Payment to a person: needs the owner',
    });
    expect(
      (await january()).filter(
        (t) => t.source === 'ai' && t.status === 'approved',
      ),
    ).toEqual([]);
  });

  it('logs every run with tokens and cost', async () => {
    const res = await admin()
      .get(`/api/ai/runs?pharmacyId=${pharmacyId}`)
      .expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        promptVersion: 1,
        model: 'claude-opus-5-5',
        requestedBy: 'Demo Admin',
        rowsSent: 4,
        rowsSuggested: 2,
        rowsUnplaced: 2,
        inputTokens: 1000,
        outputTokens: 500,
        cacheWriteTokens: 4000,
        costUsd: '0.0340',
        error: null,
      }),
    ]);
  });

  it('keeps AI suggestions when rules run again, unless a rule now matches', async () => {
    await admin()
      .post(`${base()}/transactions/categorize`, { month: '2025-01' })
      .expect(200);
    const [transfer] = await find('TRANSFER TO ACCOUNT');
    expect(transfer).toMatchObject({
      coaCode: '2510',
      source: 'ai',
      aiConfidence: 72,
    });

    rules.add({
      pharmacyId,
      keyword: 'MOBILE BANKING TRANSFER TO ACCOUNT',
      coaCode: '1015',
      tag: null,
      priority: 1,
      autoApprove: false,
      source: 'manual',
      sourceNote: null,
      retiredAt: null,
    });
    await admin()
      .post(`${base()}/transactions/categorize`, { month: '2025-01' })
      .expect(200);
    const [after] = await find('TRANSFER TO ACCOUNT');
    expect(after).toMatchObject({
      coaCode: '1015',
      source: 'rule',
      aiConfidence: null,
      aiRationale: null,
      subtag: null,
    });
  });

  it('lets a person approve or replace an AI suggestion', async () => {
    const [cash] = (await find('CHECK')).filter((t) => t.source === 'ai');
    await admin()
      .post(`${base()}/transactions/approve`, { ids: [cash.id] })
      .expect(200);
    const [approved] = (await find('CHECK')).filter((t) => t.id === cash.id);
    expect(approved).toMatchObject({
      status: 'approved',
      source: 'ai',
      aiConfidence: 55,
    });

    // Approved rows can't go back to AI.
    const again = await ask([cash.id]).expect(400);
    expect(again.body.message).toBe(NOTHING_FOR_AI);

    const changed = await admin()
      .put(`${base()}/transactions/${cash.id}`, { coaCode: '6110' })
      .expect(200);
    expect(changed.body).toMatchObject({
      source: 'staff',
      aiConfidence: null,
      aiRationale: null,
    });
  });

  it('keeps going when a batch fails or the model declines', async () => {
    const [zelle] = await find('ZELLE');
    claude.respond = () => {
      throw new Error('network down');
    };
    const failed = await ask([zelle.id]).expect(200);
    expect(failed.body).toMatchObject({
      sent: 1,
      suggested: 0,
      unplaced: 1,
      batchesFailed: 1,
      error: 'AI request failed. Try again.',
    });

    claude.respond = () => ({
      text: null,
      model: 'claude-opus-5-5',
      usage: { input: 10, output: 0, cacheWrite: 0, cacheRead: 0 },
    });
    const declined = await ask([zelle.id]).expect(200);
    expect(declined.body).toMatchObject({
      batchesFailed: 1,
      error: 'AI declined to answer this batch.',
    });
    const [still] = await find('ZELLE');
    expect(still).toMatchObject({ coaCode: '9999', status: 'uncategorized' });
  });

  it('sends more than 40 rows in batches of 40', async () => {
    const all = (await january()).filter((t) => t.status !== 'approved');
    // Make 45 rows eligible by putting rule suggestions back to 9999.
    for (const t of all.filter((x) => x.source === 'rule')) {
      await admin()
        .put(`${base()}/transactions/${t.id}`, { coaCode: '9999' })
        .expect(200);
    }
    const ids = (await january())
      .filter((t) => t.status === 'uncategorized')
      .map((t) => t.id);
    claude.calls = [];
    claude.respond = bookkeeper;
    const res = await ask(ids).expect(200);
    expect(res.body.batches).toBe(Math.ceil(ids.length / 40));
    expect(claude.calls.map((c) => sentRows(c).length)).toEqual(
      ids.length > 40 ? [40, ids.length - 40] : [ids.length],
    );
  });

  it('saves the instructions as new versions, and runs use the latest', async () => {
    const list = await admin().get('/api/ai/prompts').expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ version: 1, createdBy: 'RxBooks (built in)' }),
    ]);

    const body =
      'TEST INSTRUCTIONS v2: categorize pharmacy bank transactions, and explain briefly.';
    const saved = await admin().post('/api/ai/prompts', { body }).expect(201);
    expect(saved.body).toMatchObject({
      version: 2,
      createdBy: 'Demo Admin',
      body,
    });
    await admin().post('/api/ai/prompts', { body }).expect(400); // unchanged
    await admin().post('/api/ai/prompts', { body: 'too short' }).expect(400);

    const [zelle] = await find('ZELLE');
    claude.calls = [];
    await ask([zelle.id]).expect(200);
    expect(claude.calls[0].system).toContain('TEST INSTRUCTIONS v2');
    const runs = await admin().get('/api/ai/runs').expect(200);
    expect(runs.body[0].promptVersion).toBe(2);
  });
});
