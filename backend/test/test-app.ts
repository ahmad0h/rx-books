import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { User, type UserRole } from '../src/users/user.entity.js';

type StoredUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'role'
  | 'isActive'
  | 'passwordHash'
  | 'passwordChangedAt'
  | 'sessionVersion'
  | 'lastLoginAt'
>;

/** Just enough of TypeORM's Repository<User> for the users service, kept in memory. */
export class InMemoryUserRepository {
  rows: StoredUser[] = [];

  async add(input: {
    email: string;
    name: string;
    role: UserRole;
    password: string;
    isActive?: boolean;
  }) {
    const row: StoredUser = {
      id: this.rows.length + 1,
      email: input.email,
      name: input.name,
      role: input.role,
      isActive: input.isActive ?? true,
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: null,
      sessionVersion: 0,
      lastLoginAt: null,
    };
    this.rows.push(row);
    return row;
  }

  findOne({ where }: { where: { email?: string; id?: number } }) {
    const row = this.rows.find((r) =>
      where.id !== undefined ? r.id === where.id : r.email === where.email,
    );
    return Promise.resolve(row ? { ...row } : null);
  }

  findOneBy({ id }: { id: number }) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return Promise.resolve(null);
    const { passwordHash: _hidden, ...rest } = row;
    return Promise.resolve(rest);
  }

  existsBy({ email }: { email: string }) {
    return Promise.resolve(this.rows.some((r) => r.email === email));
  }

  update({ id }: { id: number }, patch: Partial<StoredUser>) {
    const row = this.rows.find((r) => r.id === id);
    if (row) Object.assign(row, patch);
    return Promise.resolve();
  }
}

/** The real app with the database replaced by fakes, so tests need no MySQL. */
export async function createTestApp() {
  const users = new InMemoryUserRepository();
  const dataSource = { query: vi.fn(), destroy: vi.fn() };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DataSource)
    .useValue(dataSource)
    .overrideProvider(getRepositoryToken(User))
    .useValue(users)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, users, dataSource };
}
