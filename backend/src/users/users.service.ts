import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { hashPassword } from '../auth/password.js';
import { User, type UserRole } from './user.entity.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface NewUser {
  email: string;
  name: string;
  role: UserRole;
  password: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** For sign-in only: the one place the password hash is read. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: normalizeEmail(email) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        sessionVersion: true,
        passwordHash: true,
      },
    });
  }

  /** For password changes: reads the hash of a signed-in user. */
  findByIdWithPassword(id: number): Promise<User | null> {
    return this.users.findOne({
      where: { id },
      select: {
        id: true,
        isActive: true,
        sessionVersion: true,
        passwordHash: true,
      },
    });
  }

  /**
   * Saves a new password and moves to the next session version, which ends
   * every existing session. Returns the new version.
   */
  async changePassword(
    user: Pick<User, 'id' | 'sessionVersion'>,
    newPassword: string,
  ): Promise<number> {
    const sessionVersion = user.sessionVersion + 1;
    await this.users.update(
      { id: user.id },
      {
        passwordHash: await hashPassword(newPassword),
        passwordChangedAt: new Date(),
        sessionVersion,
      },
    );
    return sessionVersion;
  }

  findById(id: number): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.users.existsBy({ email: normalizeEmail(email) });
  }

  async recordLogin(id: number): Promise<void> {
    await this.users.update({ id }, { lastLoginAt: new Date() });
  }

  async create(input: NewUser): Promise<User> {
    const user = this.users.create({
      email: normalizeEmail(input.email),
      name: input.name.trim(),
      role: input.role,
      passwordHash: await hashPassword(input.password),
      isActive: true,
    });
    return this.users.save(user);
  }
}
