import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { Pharmacy } from '../src/pharmacies/pharmacy.entity.js';
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

/** The real app with the database replaced by fakes, so tests need no MySQL. */
export async function createTestApp() {
  const users = new InMemoryUserRepository();
  const pharmacies = new InMemoryPharmacyRepository();
  const manager = {
    getRepository: (entity: unknown) =>
      entity === User ? users : entity === Pharmacy ? pharmacies : undefined,
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
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, users, pharmacies, dataSource };
}
