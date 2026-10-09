import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { hashPassword } from '../auth/password.js';
import { User } from '../users/user.entity.js';
import { DEFAULT_OWNER_PASSWORD } from './owner-account.js';
import { Pharmacy } from './pharmacy.entity.js';
import type { PharmacyInput } from './pharmacy.input.js';

export const DUPLICATE_PHARMACY_NAME =
  'A pharmacy with this name already exists.';
export const OWNER_EMAIL_TAKEN =
  'This owner email is already used by another user.';

@Injectable()
export class PharmaciesService {
  constructor(
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  list(): Promise<Pharmacy[]> {
    return this.pharmacies.find({ order: { name: 'ASC' } });
  }

  async get(id: number): Promise<Pharmacy> {
    const pharmacy = await this.pharmacies.findOneBy({ id });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found.');
    return pharmacy;
  }

  /**
   * Adds a pharmacy and, in the same transaction, the owner's client login
   * (email = owner email, temporary password DEFAULT_OWNER_PASSWORD).
   */
  async create(input: PharmacyInput): Promise<Pharmacy> {
    await this.assertNameFree(input.name);
    await this.assertOwnerEmailFree(input.ownerEmail);

    return this.inTransaction(async (em) => {
      const pharmacies = em.getRepository(Pharmacy);
      const pharmacy = await pharmacies.save(
        pharmacies.create({
          name: input.name,
          ownerName: input.ownerName,
          ownerPhone: input.ownerPhone,
          ownerEmail: input.ownerEmail,
        }),
      );

      const users = em.getRepository(User);
      await users.save(
        users.create({
          email: input.ownerEmail,
          name: input.ownerName,
          role: 'client',
          pharmacyId: pharmacy.id,
          passwordHash: await hashPassword(DEFAULT_OWNER_PASSWORD),
          isActive: true,
        }),
      );
      return pharmacy;
    });
  }

  /** Updates a pharmacy and keeps the owner's login name and email in step. */
  async update(id: number, input: PharmacyInput): Promise<Pharmacy> {
    const pharmacy = await this.get(id);
    const owner = await this.users.findOne({
      where: { pharmacyId: id, role: 'client' },
    });
    await this.assertNameFree(input.name, id);
    await this.assertOwnerEmailFree(input.ownerEmail, owner?.id);

    return this.inTransaction(async (em) => {
      Object.assign(pharmacy, input);
      const saved = await em.getRepository(Pharmacy).save(pharmacy);
      if (owner) {
        await em
          .getRepository(User)
          .update(
            { id: owner.id },
            { email: input.ownerEmail, name: input.ownerName },
          );
      }
      return saved;
    });
  }

  /** Friendly checks first; the database's unique indexes are the final guard. */
  private async assertNameFree(name: string, exceptId?: number) {
    const existing = await this.pharmacies.findOne({ where: { name } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(DUPLICATE_PHARMACY_NAME);
    }
  }

  private async assertOwnerEmailFree(email: string, exceptUserId?: number) {
    const existing = await this.users.findOne({ where: { email } });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException(OWNER_EMAIL_TAKEN);
    }
  }

  private async inTransaction<T>(
    work: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(work);
    } catch (error) {
      const { code, message } = error as { code?: string; message?: string };
      if (code === 'ER_DUP_ENTRY') {
        throw new ConflictException(
          message?.includes('uq_users_email')
            ? OWNER_EMAIL_TAKEN
            : DUPLICATE_PHARMACY_NAME,
        );
      }
      throw error;
    }
  }
}
