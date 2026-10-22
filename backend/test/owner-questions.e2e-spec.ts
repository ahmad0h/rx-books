import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DEFAULT_OWNER_PASSWORD } from '../src/pharmacies/owner-account.js';
import {
  ALREADY_RESOLVED,
  NOT_LINKED,
} from '../src/owner-questions/owner-questions.service.js';
import {
  createTestApp,
  type InMemoryCoaRepository,
  type InMemoryUserRepository,
} from './test-app.js';

interface Question {
  id: number;
  status: string;
  suggestedLabel: string | null;
  staffNote: string | null;
  answerLabel: string | null;
  answerUnsure: boolean;
  answerNote: string | null;
  willSendDocument: boolean;
}
interface Row {
  id: number;
  description: string;
  status: string;
  source: string | null;
  coaCode: string;
  question: Question | null;
}

const coaRow = (
  code: string,
  name: string,
  type: string,
  extra: {
    ownerLabel?: string | null;
    isActive?: boolean;
    categorizable?: boolean;
  } = {},
) => ({
  code,
  name,
  type: type as 'asset',
  expenseGroup: type === 'expense' ? ('General' as const) : null,
  description: null,
  ownerLabel: extra.ownerLabel ?? null,
  contraOf: null,
  categorizable: extra.categorizable ?? true,
  isActive: extra.isActive ?? true,
});

const HEADER = 'Date,Transaction,Name,Memo,Amount';
const LAKESIDE_ROWS = [
  '01/03/2025,DEBIT,ZELLE INSTANT PMT TO JORDAN LEE,,-450.00',
  '01/05/2025,DEBIT,AMAZON MKTPLACE PMTS,,-143.99',
  '01/09/2025,DEBIT,CHECK,,-2800.00',
  '01/10/2025,DEBIT,OLIVE GARDEN 1201,,-246.80',
  '01/11/2025,DEBIT,TARGET 00012,,-61.30',
  '01/12/2025,DEBIT,CARIBOU COFFEE 112,,-38.40',
  '01/13/2025,DEBIT,DELTA AIR 0062,,-388.20',
  '01/14/2025,DEBIT,CHECK,,-1250.00',
];

describe('Owner questions (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;
  let coa: InMemoryCoaRepository;
  let adminCookie: string;
  let ownerCookie: string;
  let otherOwnerCookie: string;
  let unlinkedCookie: string;
  let lakeside: number;
  let aspen: number;
  let ip = 0;

  const signIn = async (email: string, password: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', `10.9.0.${++ip}`)
        .send({ email, password })
        .expect(200)
    ).headers['set-cookie']![0].split(';')[0];
  const as = (cookie: string) => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Cookie', cookie),
    post: (url: string, body: object = {}) =>
      request(app.getHttpServer()).post(url).set('Cookie', cookie).send(body),
    put: (url: string, body: object) =>
      request(app.getHttpServer()).put(url).set('Cookie', cookie).send(body),
  });
  const admin = () => as(adminCookie);
  const owner = () => as(ownerCookie);
  const january = async (pharmacyId = lakeside) =>
    (
      await admin()
        .get(`/api/pharmacies/${pharmacyId}/transactions?month=2025-01`)
        .expect(200)
    ).body as { transactions: Row[]; totals: Record<string, number> };
  const row = async (text: string, nth = 0) =>
    (await january()).transactions.filter((t) => t.description.includes(text))[
      nth
    ];
  const ask = (items: object[], pharmacyId = lakeside) =>
    admin().post(`/api/pharmacies/${pharmacyId}/questions`, { items });

  const addPharmacy = async (name: string, email: string) =>
    (
      (
        await admin()
          .post('/api/pharmacies', {
            name,
            ownerName: 'Owner',
            ownerPhone: '(612) 555-0142',
            ownerEmail: email,
          })
          .expect(201)
      ).body as { id: number }
    ).id;
  const upload = async (
    pharmacyId: number,
    lastFour: string,
    rows: string[],
  ) => {
    const account = (
      (
        await admin()
          .post(`/api/pharmacies/${pharmacyId}/accounts`, {
            name: 'Main checking',
            kind: 'checking',
            bank: 'US Bank',
            lastFour,
            coaCode: '1010',
            openedOn: null,
            closedOn: null,
            notes: null,
          })
          .expect(201)
      ).body as { id: number }
    ).id;
    await admin()
      .post(`/api/pharmacies/${pharmacyId}/uploads`, {
        accountId: account,
        fileName: 'jan.csv',
        content: [HEADER, ...rows].join('\n'),
      })
      .expect(201);
  };

  beforeAll(async () => {
    ({ app, users, coa } = await createTestApp());
    coa.add(
      coaRow('1010', 'Cash — checking 1', 'asset', {
        ownerLabel: 'Checking account',
      }),
    );
    coa.add(
      coaRow('1015', 'Cash on Hand', 'asset', {
        ownerLabel: 'Cash kept at the pharmacy',
      }),
    );
    coa.add(
      coaRow('1515', 'Accumulated depreciation', 'asset', {
        categorizable: false,
      }),
    );
    coa.add(
      coaRow('2510', 'Owner draw / personal', 'equity', {
        ownerLabel: 'Personal / owner use',
      }),
    );
    coa.add(
      coaRow('6040', 'Contract labor', 'expense', {
        ownerLabel: 'Contractors (1099)',
      }),
    );
    coa.add(
      coaRow('6310', 'Office supplies', 'expense', {
        ownerLabel: 'Office supplies',
      }),
    );
    coa.add(coaRow('6380', 'Travel — business', 'expense'));
    coa.add(
      coaRow('6999', 'Old account', 'expense', {
        isActive: false,
        ownerLabel: 'Old',
      }),
    );
    coa.add(
      coaRow('9999', 'Uncategorized — needs review', 'review', {
        ownerLabel: 'Not sure',
      }),
    );

    await users.add({
      email: 'admin@rxbooks.test',
      password: 'admin-password-123',
      name: 'Demo Admin',
      role: 'admin',
    });
    await users.add({
      email: 'nobody@rxbooks.test',
      password: 'client-password-123',
      name: 'Unlinked',
      role: 'client',
    });
    adminCookie = await signIn('admin@rxbooks.test', 'admin-password-123');
    unlinkedCookie = await signIn('nobody@rxbooks.test', 'client-password-123');

    lakeside = await addPharmacy(
      'Lakeside Community Pharmacy',
      'owner@lakeside.test',
    );
    aspen = await addPharmacy('Aspen Drug', 'owner@aspen.test');
    ownerCookie = await signIn('owner@lakeside.test', DEFAULT_OWNER_PASSWORD);
    otherOwnerCookie = await signIn('owner@aspen.test', DEFAULT_OWNER_PASSWORD);
    await upload(lakeside, '4821', LAKESIDE_ROWS);
    await upload(aspen, '5555', ['01/04/2025,DEBIT,STAPLES 22,,-80.00']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets staff ask about rows with a suggestion and a note', async () => {
    const zelle = await row('ZELLE');
    const amazon = await row('AMAZON');
    const res = await ask([
      {
        transactionId: zelle.id,
        suggestedCode: '6040',
        note: 'Who is Jordan Lee?',
      },
      { transactionId: amazon.id, suggestedCode: '6310', note: '  ' },
    ]).expect(201);
    expect(res.body).toEqual({
      asked: 2,
      openByMonth: { '2025-01': 2 },
      overSoftCap: [],
    });

    const after = await january();
    expect(after.totals).toMatchObject({
      questionsWaiting: 2,
      questionsAnswered: 0,
    });
    expect((await row('ZELLE')).question).toMatchObject({
      status: 'waiting',
      suggestedLabel: '6040 · Contract labor',
      staffNote: 'Who is Jordan Lee?',
    });
    expect((await row('AMAZON')).question?.staffNote).toBeNull();
  });

  it('refuses double questions, approved rows and categories owners can’t pick', async () => {
    const zelle = await row('ZELLE');
    const check = await row('CHECK');
    await ask([{ transactionId: zelle.id }]).expect(409);
    await ask([
      { transactionId: check.id },
      { transactionId: check.id },
    ]).expect(400);
    await ask([{ transactionId: check.id, suggestedCode: '1515' }]).expect(400);
    await ask([{ transactionId: check.id, suggestedCode: '9999' }]).expect(400);
    await ask([{ transactionId: 99999 }]).expect(404);
    await ask([], lakeside).expect(400);

    await admin()
      .put(`/api/pharmacies/${lakeside}/transactions/${check.id}`, {
        coaCode: '1015',
      })
      .expect(200);
    await ask([{ transactionId: check.id }]).expect(400); // approved
    await admin()
      .put(`/api/pharmacies/${lakeside}/transactions/${check.id}`, {
        coaCode: '9999',
      })
      .expect(200);

    await as(ownerCookie)
      .post(`/api/pharmacies/${lakeside}/questions`, {
        items: [{ transactionId: check.id }],
      })
      .expect(403);
  });

  it('shows owners only their own questions, without codes or AI reasons', async () => {
    const res = await owner().get('/api/client/questions').expect(200);
    expect(res.body.pharmacyName).toBe('Lakeside Community Pharmacy');
    expect(res.body.questions).toEqual([
      {
        id: expect.any(Number),
        date: '2025-01-03',
        description: 'ZELLE INSTANT PMT TO JORDAN LEE',
        amount: '-450.00',
        account: 'Main checking •••• 4821',
        suggested: '6040',
        note: 'Who is Jordan Lee?',
        status: 'waiting',
        answer: null,
      },
      expect.objectContaining({
        description: 'AMAZON MKTPLACE PMTS',
        suggested: '6310',
        note: null,
      }),
    ]);
    const other = await as(otherOwnerCookie)
      .get('/api/client/questions')
      .expect(200);
    expect(other.body).toEqual({ pharmacyName: 'Aspen Drug', questions: [] });

    const unlinked = await as(unlinkedCookie)
      .get('/api/client/questions')
      .expect(403);
    expect(unlinked.body.message).toBe(NOT_LINKED);
    await admin().get('/api/client/questions').expect(403);
  });

  it('offers owners plain-language categories only', async () => {
    const res = await owner().get('/api/client/categories').expect(200);
    // Grouped in a fixed order, sorted by name; no codes in the labels.
    expect(res.body).toEqual([
      {
        value: '6040',
        label: 'Contractors (1099)',
        group: 'Running the pharmacy',
      },
      {
        value: '6310',
        label: 'Office supplies',
        group: 'Running the pharmacy',
      },
      {
        value: '6380',
        label: 'Travel — business',
        group: 'Running the pharmacy',
      },
      {
        value: '1015',
        label: 'Cash kept at the pharmacy',
        group: 'Accounts & property',
      },
      {
        value: '1010',
        label: 'Checking account',
        group: 'Accounts & property',
      },
      { value: '2510', label: 'Personal / owner use', group: 'Owner' },
    ]);
    // 1515 (journal entries only), 6999 (inactive) and 9999 never appear.
  });

  it('lets the owner answer, change an answer, or say "not sure"', async () => {
    const { questions } = (await owner().get('/api/client/questions')).body as {
      questions: { id: number; description: string }[];
    };
    const zelle = questions.find((q) => q.description.includes('ZELLE'))!;
    const amazon = questions.find((q) => q.description.includes('AMAZON'))!;

    await owner()
      .put(`/api/client/questions/${zelle.id}`, {
        category: '2510',
        note: 'My son',
        willSendDocument: false,
      })
      .expect(204);
    await owner()
      .put(`/api/client/questions/${zelle.id}`, {
        category: '6040',
        note: 'Delivery driver',
        willSendDocument: true,
      })
      .expect(204);
    await owner()
      .put(`/api/client/questions/${amazon.id}`, {
        category: 'unsure',
        note: null,
        willSendDocument: false,
      })
      .expect(204);

    await owner()
      .put(`/api/client/questions/${zelle.id}`, {
        category: '1515',
        willSendDocument: false,
      })
      .expect(400);
    await owner()
      .put(`/api/client/questions/${zelle.id}`, {
        category: 'abc',
        willSendDocument: false,
      })
      .expect(400);
    await as(otherOwnerCookie)
      .put(`/api/client/questions/${zelle.id}`, {
        category: '6040',
        willSendDocument: false,
      })
      .expect(404);

    const mine = (await owner().get('/api/client/questions')).body as {
      questions: {
        description: string;
        status: string;
        answer: Record<string, unknown> | null;
      }[];
    };
    expect(
      mine.questions.find((q) => q.description.includes('ZELLE')),
    ).toMatchObject({
      status: 'answered',
      answer: {
        category: '6040',
        note: 'Delivery driver',
        willSendDocument: true,
      },
    });

    expect((await row('ZELLE')).question).toMatchObject({
      status: 'answered',
      answerLabel: '6040 · Contract labor',
      answerNote: 'Delivery driver',
      willSendDocument: true,
    });
    expect((await row('AMAZON')).question).toMatchObject({
      status: 'answered',
      answerUnsure: true,
      answerLabel: null,
    });
    expect((await january()).totals).toMatchObject({
      questionsWaiting: 0,
      questionsAnswered: 2,
    });
  });

  it('accepting uses the owner’s answer and approves the row', async () => {
    const zelle = await row('ZELLE');
    const amazon = await row('AMAZON');
    await admin()
      .post(
        `/api/pharmacies/${lakeside}/questions/${amazon.question!.id}/accept`,
      )
      .expect(400); // not sure
    await admin()
      .post(
        `/api/pharmacies/${lakeside}/questions/${zelle.question!.id}/accept`,
      )
      .expect(204);

    expect(await row('ZELLE')).toMatchObject({
      coaCode: '6040',
      status: 'approved',
      source: 'owner',
      question: { status: 'accepted' },
    });
    const late = await owner()
      .put(`/api/client/questions/${zelle.question!.id}`, {
        category: '2510',
        willSendDocument: false,
      })
      .expect(409);
    expect(late.body.message).toBe(ALREADY_RESOLVED);
    const left = (await owner().get('/api/client/questions')).body as {
      questions: unknown[];
    };
    expect(left.questions).toHaveLength(1);
  });

  it('choosing a category yourself overrides an answer; cancelling withdraws a question', async () => {
    const amazon = await row('AMAZON');
    await admin()
      .put(`/api/pharmacies/${lakeside}/transactions/${amazon.id}`, {
        coaCode: '6310',
      })
      .expect(200);
    expect(await row('AMAZON')).toMatchObject({
      source: 'staff',
      question: { status: 'overridden' },
    });

    const olive = await row('OLIVE GARDEN');
    await ask([{ transactionId: olive.id }]).expect(201);
    const asked = await row('OLIVE GARDEN');
    await admin()
      .post(
        `/api/pharmacies/${lakeside}/questions/${asked.question!.id}/cancel`,
      )
      .expect(204);
    expect((await row('OLIVE GARDEN')).question?.status).toBe('cancelled');
    await admin()
      .post(
        `/api/pharmacies/${lakeside}/questions/${asked.question!.id}/cancel`,
      )
      .expect(400);
    await admin()
      .post(
        `/api/pharmacies/${lakeside}/questions/${asked.question!.id}/accept`,
      )
      .expect(400);
    // Asking again is fine once the old question is closed.
    await ask([{ transactionId: olive.id }]).expect(201);
  });

  it('warns past 5 open questions in a month', async () => {
    const ids = (await january()).transactions
      .filter(
        (t) =>
          t.status !== 'approved' &&
          !['waiting', 'answered'].includes(t.question?.status ?? ''),
      )
      .map((t) => ({ transactionId: t.id }));
    const res = await ask(ids).expect(201);
    expect(res.body.openByMonth['2025-01']).toBeGreaterThan(5);
    expect(res.body.overSoftCap).toEqual(['2025-01']);
  });
});
