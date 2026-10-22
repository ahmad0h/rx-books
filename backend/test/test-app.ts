import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, FindOperator } from 'typeorm';
import { AiPrompt } from '../src/ai/ai-prompt.entity.js';
import { AiRun } from '../src/ai/ai-run.entity.js';
import {
  ClaudeClient,
  type ClassifyRequest,
  type ClassifyResult,
} from '../src/ai/claude.client.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { CoaAccount } from '../src/coa/coa-account.entity.js';
import { Pharmacy } from '../src/pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from '../src/pharmacy-accounts/pharmacy-account.entity.js';
import { Rule } from '../src/rules/rule.entity.js';
import { BankTransaction } from '../src/transactions/bank-transaction.entity.js';
import { TransactionUpload } from '../src/transactions/transaction-upload.entity.js';
import { User, type UserRole } from '../src/users/user.entity.js';

type StoredUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'role'
  | 'pharmacyId'
  | 'isActive'
  | 'passwordHash'
  | 'passwordChangedAt'
  | 'sessionVersion'
  | 'lastLoginAt'
>;

/** True when every key in `where` equals the row's value. */
function matches(row: object, where: object): boolean {
  return Object.entries(where).every(
    ([key, value]) => (row as Record<string, unknown>)[key] === value,
  );
}

/** Just enough of TypeORM's Repository<User>, kept in memory. */
export class InMemoryUserRepository {
  rows: StoredUser[] = [];

  async add(input: {
    email: string;
    name: string;
    role: UserRole;
    password: string;
    isActive?: boolean;
    pharmacyId?: number | null;
  }) {
    const row: StoredUser = {
      id: this.rows.length + 1,
      email: input.email,
      name: input.name,
      role: input.role,
      pharmacyId: input.pharmacyId ?? null,
      isActive: input.isActive ?? true,
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: null,
      sessionVersion: 0,
      lastLoginAt: null,
    };
    this.rows.push(row);
    return row;
  }

  findOne({ where }: { where: Partial<StoredUser> }) {
    const row = this.rows.find((r) => matches(r, where));
    return Promise.resolve(row ? { ...row } : null);
  }

  findOneBy({ id }: { id: number }) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return Promise.resolve(null);
    const { passwordHash: _hidden, ...rest } = row;
    return Promise.resolve(rest);
  }

  existsBy(where: Partial<StoredUser>) {
    return Promise.resolve(this.rows.some((r) => matches(r, where)));
  }

  create(input: Partial<StoredUser>) {
    return { ...input } as StoredUser;
  }

  save(user: StoredUser) {
    if (this.rows.some((r) => r.email === user.email && r.id !== user.id)) {
      return Promise.reject(
        Object.assign(new Error("Duplicate entry for key 'uq_users_email'"), {
          code: 'ER_DUP_ENTRY',
        }),
      );
    }
    const row: StoredUser = {
      pharmacyId: null,
      passwordChangedAt: null,
      sessionVersion: 0,
      lastLoginAt: null,
      ...user,
      id: this.rows.length + 1,
    };
    this.rows.push(row);
    return Promise.resolve({ ...row });
  }

  update({ id }: { id: number }, patch: Partial<StoredUser>) {
    const row = this.rows.find((r) => r.id === id);
    if (row) Object.assign(row, patch);
    return Promise.resolve();
  }
}

type StoredPharmacy = Pick<
  Pharmacy,
  | 'id'
  | 'name'
  | 'ownerName'
  | 'ownerPhone'
  | 'ownerEmail'
  | 'createdAt'
  | 'updatedAt'
>;

/** Just enough of TypeORM's Repository<Pharmacy>, kept in memory. */
export class InMemoryPharmacyRepository {
  rows: StoredPharmacy[] = [];

  find() {
    return Promise.resolve(
      [...this.rows].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  findOneBy({ id }: { id: number }) {
    const row = this.rows.find((r) => r.id === id);
    return Promise.resolve(row ? { ...row } : null);
  }

  existsBy({ id }: { id: number }) {
    return Promise.resolve(this.rows.some((r) => r.id === id));
  }

  /** Case-insensitive, like the MySQL collation. */
  findOne({ where }: { where: { name: string } }) {
    const name = where.name.toLowerCase();
    const row = this.rows.find((r) => r.name.toLowerCase() === name);
    return Promise.resolve(row ? { ...row } : null);
  }

  create(input: Partial<StoredPharmacy>) {
    return { ...input } as StoredPharmacy;
  }

  save(pharmacy: StoredPharmacy) {
    const now = new Date();
    const existing = this.rows.find((r) => r.id === pharmacy.id);
    if (existing) {
      Object.assign(existing, pharmacy, { updatedAt: now });
      return Promise.resolve({ ...existing });
    }
    const row = {
      ...pharmacy,
      id: this.rows.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return Promise.resolve({ ...row });
  }
}

type StoredAccount = Pick<
  CoaAccount,
  | 'code'
  | 'name'
  | 'type'
  | 'expenseGroup'
  | 'description'
  | 'ownerLabel'
  | 'categorizable'
  | 'contraOf'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
>;

/** Just enough of TypeORM's Repository<CoaAccount>, kept in memory. */
export class InMemoryCoaRepository {
  rows: StoredAccount[] = [];

  add(account: Omit<StoredAccount, 'createdAt' | 'updatedAt'>) {
    const now = new Date();
    this.rows.push({ ...account, createdAt: now, updatedAt: now });
  }

  find() {
    return Promise.resolve(
      [...this.rows].sort((a, b) => a.code.localeCompare(b.code)),
    );
  }

  findOneBy({ code }: { code: string }) {
    const row = this.rows.find((r) => r.code === code);
    return Promise.resolve(row ? { ...row } : null);
  }

  existsBy({ code }: { code: string }) {
    return Promise.resolve(this.rows.some((r) => r.code === code));
  }

  /** Case-insensitive, like the MySQL collation. */
  findOne({ where }: { where: { name: string } }) {
    const name = where.name.toLowerCase();
    const row = this.rows.find((r) => r.name.toLowerCase() === name);
    return Promise.resolve(row ? { ...row } : null);
  }

  create(input: Partial<StoredAccount>) {
    return { ...input } as StoredAccount;
  }

  save(account: StoredAccount) {
    const now = new Date();
    const existing = this.rows.find((r) => r.code === account.code);
    if (existing) {
      Object.assign(existing, account, { updatedAt: now });
      return Promise.resolve({ ...existing });
    }
    const row = { ...account, createdAt: now, updatedAt: now };
    this.rows.push(row);
    return Promise.resolve({ ...row });
  }
}

type StoredRule = Pick<
  Rule,
  | 'id'
  | 'pharmacyId'
  | 'keyword'
  | 'coaCode'
  | 'tag'
  | 'priority'
  | 'autoApprove'
  | 'source'
  | 'sourceNote'
  | 'createdAt'
  | 'updatedAt'
  | 'retiredAt'
>;

/** Like `matches`, but also understands TypeORM's IsNull(). */
function matchesWhere(row: object, where: object): boolean {
  return Object.entries(where).every(([key, value]) => {
    const actual = (row as Record<string, unknown>)[key];
    if (value instanceof FindOperator) {
      if (value.type === 'isNull') return actual === null;
      if (value.type === 'in') {
        return (value.value as unknown as unknown[]).includes(actual);
      }
      throw new Error(`Fake repository does not support ${value.type}`);
    }
    return actual === value;
  });
}

/** Just enough of TypeORM's Repository<Rule>, kept in memory. */
export class InMemoryRuleRepository {
  rows: StoredRule[] = [];

  add(
    input: Omit<StoredRule, 'id' | 'createdAt' | 'updatedAt'> & {
      createdAt?: Date;
    },
  ) {
    const now = new Date();
    const row: StoredRule = {
      ...input,
      id: this.rows.length + 1,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }

  find({ where }: { where: object }) {
    return Promise.resolve(
      this.rows.filter((r) => matchesWhere(r, where)).map((r) => ({ ...r })),
    );
  }

  findOneBy({ id }: { id: number }) {
    const row = this.rows.find((r) => r.id === id);
    return Promise.resolve(row ? { ...row } : null);
  }

  existsBy(where: object) {
    return Promise.resolve(this.rows.some((r) => matchesWhere(r, where)));
  }

  create(input: Partial<StoredRule>) {
    return { ...input } as StoredRule;
  }

  save(rule: StoredRule) {
    const now = new Date();
    const existing = this.rows.find((r) => r.id === rule.id);
    if (existing) {
      Object.assign(existing, rule, { updatedAt: now });
      return Promise.resolve({ ...existing });
    }
    const row = {
      ...rule,
      id: this.rows.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return Promise.resolve({ ...row });
  }
}

type StoredPharmacyAccount = Pick<
  PharmacyAccount,
  | 'id'
  | 'pharmacyId'
  | 'name'
  | 'kind'
  | 'bank'
  | 'lastFour'
  | 'coaCode'
  | 'openedOn'
  | 'closedOn'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'
>;

/** Just enough of TypeORM's Repository<PharmacyAccount>, kept in memory. */
export class InMemoryPharmacyAccountRepository {
  rows: StoredPharmacyAccount[] = [];

  find({ where }: { where: object }) {
    return Promise.resolve(
      this.rows.filter((r) => matchesWhere(r, where)).map((r) => ({ ...r })),
    );
  }

  findOneBy(where: object) {
    const row = this.rows.find((r) => matchesWhere(r, where));
    return Promise.resolve(row ? { ...row } : null);
  }

  existsBy(where: object) {
    return Promise.resolve(this.rows.some((r) => matchesWhere(r, where)));
  }

  create(input: Partial<StoredPharmacyAccount>) {
    return { ...input } as StoredPharmacyAccount;
  }

  save(account: StoredPharmacyAccount) {
    const now = new Date();
    const existing = this.rows.find((r) => r.id === account.id);
    if (existing) {
      Object.assign(existing, account, { updatedAt: now });
      return Promise.resolve({ ...existing });
    }
    const row = {
      ...account,
      id: this.rows.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return Promise.resolve({ ...row });
  }
}

/**
 * A generic in-memory table: enough of TypeORM's Repository for the uploads
 * and transactions code. `unique` names a column that must not repeat,
 * like a unique index (a clash throws ER_DUP_ENTRY).
 */
export class InMemoryTable<T extends { id: number; createdAt: Date }> {
  rows: T[] = [];

  constructor(private readonly unique?: keyof T) {}

  find({ where }: { where: object }) {
    return Promise.resolve(
      this.rows.filter((r) => matchesWhere(r, where)).map((r) => ({ ...r })),
    );
  }

  findOneBy(where: object) {
    const row = this.rows.find((r) => matchesWhere(r, where));
    return Promise.resolve(row ? { ...row } : null);
  }

  existsBy(where: object) {
    return Promise.resolve(this.rows.some((r) => matchesWhere(r, where)));
  }

  create(input: Partial<T>) {
    return { ...input } as T;
  }

  save(input: T): Promise<T>;
  save(input: T[], options?: object): Promise<T[]>;
  save(input: T | T[]): Promise<T | T[]> {
    const items = Array.isArray(input) ? input : [input];
    const stored = (item: T) =>
      item.id ? this.rows.find((r) => r.id === item.id) : undefined;
    const key = this.unique;
    if (key) {
      const seen = new Set(this.rows.map((r) => r[key]));
      for (const item of items.filter((i) => !stored(i))) {
        if (seen.has(item[key])) {
          return Promise.reject(
            Object.assign(new Error('Duplicate entry'), {
              code: 'ER_DUP_ENTRY',
            }),
          );
        }
        seen.add(item[key]);
      }
    }
    const saved = items.map((item) => {
      const existing = stored(item);
      if (existing) {
        Object.assign(existing, item);
        return { ...existing };
      }
      const row = {
        ...item,
        id: this.rows.length + 1,
        createdAt: new Date(),
      };
      this.rows.push(row);
      return { ...row };
    });
    return Promise.resolve(Array.isArray(input) ? saved : saved[0]);
  }
}

/**
 * Stands in for Claude: records every request and answers with `respond`,
 * so tests never call the API or spend money.
 */
export class FakeClaude {
  enabled = true;
  model = 'claude-opus-5-5';
  calls: ClassifyRequest[] = [];
  respond: (
    request: ClassifyRequest,
  ) => ClassifyResult | Promise<ClassifyResult> = () => ({
    text: JSON.stringify({ suggestions: [] }),
    model: this.model,
    usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  });

  classify(request: ClassifyRequest): Promise<ClassifyResult> {
    this.calls.push(request);
    return Promise.resolve(this.respond(request));
  }
}

/** The real app with the database replaced by fakes, so tests need no MySQL. */
export async function createTestApp() {
  const users = new InMemoryUserRepository();
  const pharmacies = new InMemoryPharmacyRepository();
  const coa = new InMemoryCoaRepository();
  const rules = new InMemoryRuleRepository();
  const accounts = new InMemoryPharmacyAccountRepository();
  const uploads = new InMemoryTable<TransactionUpload>();
  const transactions = new InMemoryTable<BankTransaction>('sourceRowId');
  const aiPrompts = new InMemoryTable<AiPrompt>('version');
  const aiRuns = new InMemoryTable<AiRun>();
  const claude = new FakeClaude();
  void aiPrompts.save({
    version: 1,
    body: 'TEST INSTRUCTIONS: categorize pharmacy bank transactions carefully.',
    createdBy: null,
  } as AiPrompt);
  const manager = {
    getRepository: (entity: unknown) =>
      new Map<unknown, unknown>([
        [User, users],
        [Pharmacy, pharmacies],
        [TransactionUpload, uploads],
        [BankTransaction, transactions],
      ]).get(entity),
  };
  const dataSource = {
    query: vi.fn(),
    destroy: vi.fn(),
    // Runs the work directly; the fakes have no real transactions.
    transaction: (work: (em: typeof manager) => Promise<unknown>) =>
      work(manager),
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DataSource)
    .useValue(dataSource)
    .overrideProvider(getRepositoryToken(User))
    .useValue(users)
    .overrideProvider(getRepositoryToken(Pharmacy))
    .useValue(pharmacies)
    .overrideProvider(getRepositoryToken(CoaAccount))
    .useValue(coa)
    .overrideProvider(getRepositoryToken(Rule))
    .useValue(rules)
    .overrideProvider(getRepositoryToken(PharmacyAccount))
    .useValue(accounts)
    .overrideProvider(getRepositoryToken(TransactionUpload))
    .useValue(uploads)
    .overrideProvider(getRepositoryToken(BankTransaction))
    .useValue(transactions)
    .overrideProvider(getRepositoryToken(AiPrompt))
    .useValue(aiPrompts)
    .overrideProvider(getRepositoryToken(AiRun))
    .useValue(aiRuns)
    .overrideProvider(ClaudeClient)
    .useValue(claude)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return {
    app,
    users,
    pharmacies,
    coa,
    rules,
    accounts,
    uploads,
    transactions,
    aiPrompts,
    aiRuns,
    claude,
    dataSource,
  };
}
