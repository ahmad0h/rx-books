import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CoaService } from '../coa/coa.service.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { codeFitsKind } from './account-codes.js';
import {
  PharmacyAccount,
  type PharmacyAccountView,
} from './pharmacy-account.entity.js';
import type { PharmacyAccountInput } from './pharmacy-account.input.js';

export const CODE_TAKEN =
  'This pharmacy already has an account with this code.';
export const NUMBER_TAKEN =
  'This pharmacy already has an account at this bank ending in these digits.';

const KIND_RANGE = {
  checking: 'a 10xx cash code (not 1015)',
  savings: 'a 10xx cash code (not 1015)',
  credit_card: 'a 20xx credit card code',
} as const;

@Injectable()
export class PharmacyAccountsService {
  constructor(
    @InjectRepository(PharmacyAccount)
    private readonly accounts: Repository<PharmacyAccount>,
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    private readonly coa: CoaService,
  ) {}

  /** A pharmacy's accounts: open ones first, then by code. */
  async list(pharmacyId: number): Promise<PharmacyAccountView[]> {
    await this.requirePharmacy(pharmacyId);
    const rows = await this.accounts.find({ where: { pharmacyId } });
    rows.sort(
      (a, b) =>
        Number(a.closedOn !== null) - Number(b.closedOn !== null) ||
        a.coaCode.localeCompare(b.coaCode),
    );
    return this.views(rows);
  }

  async create(
    pharmacyId: number,
    input: PharmacyAccountInput,
  ): Promise<PharmacyAccountView> {
    await this.requirePharmacy(pharmacyId);
    const siblings = await this.accounts.find({ where: { pharmacyId } });
    await this.check(input, siblings);
    const account = this.accounts.create({
      pharmacyId,
      ...this.fields(input),
    });
    return this.view(await this.save(account));
  }

  async update(
    pharmacyId: number,
    id: number,
    input: PharmacyAccountInput,
  ): Promise<PharmacyAccountView> {
    const account = await this.accounts.findOneBy({ id, pharmacyId });
    if (!account) throw new NotFoundException('Account not found.');
    const siblings = await this.accounts.find({ where: { pharmacyId } });
    await this.check(input, siblings, account);
    Object.assign(account, this.fields(input));
    return this.view(await this.save(account));
  }

  private async requirePharmacy(id: number) {
    if (!(await this.pharmacies.existsBy({ id }))) {
      throw new NotFoundException('Pharmacy not found.');
    }
  }

  private fields(input: PharmacyAccountInput) {
    return {
      name: input.name,
      kind: input.kind,
      bank: input.bank,
      lastFour: input.lastFour,
      coaCode: input.coaCode,
      openedOn: input.openedOn ?? null,
      closedOn: input.closedOn ?? null,
      notes: input.notes ?? null,
    };
  }

  private async check(
    input: PharmacyAccountInput,
    siblings: PharmacyAccount[],
    self?: PharmacyAccount,
  ) {
    const others = siblings.filter((a) => a.id !== self?.id);
    const code = (await this.coa.list()).find((a) => a.code === input.coaCode);
    if (!code) {
      throw new BadRequestException(`Account ${input.coaCode} does not exist.`);
    }
    if (!codeFitsKind(input.kind, code)) {
      throw new BadRequestException(
        `${code.label} doesn't fit this account. Use ${KIND_RANGE[input.kind]}.`,
      );
    }
    // A code that was later deactivated is fine on an account that already uses it.
    if (!code.isActive && self?.coaCode !== code.code) {
      throw new BadRequestException(`${code.label} is inactive.`);
    }
    if (others.some((a) => a.coaCode === input.coaCode)) {
      throw new ConflictException(CODE_TAKEN);
    }
    if (
      others.some(
        (a) =>
          a.lastFour === input.lastFour &&
          a.bank.toLowerCase() === input.bank.toLowerCase(),
      )
    ) {
      throw new ConflictException(NUMBER_TAKEN);
    }
    if (input.openedOn && input.closedOn && input.closedOn < input.openedOn) {
      throw new BadRequestException(
        'The closing date cannot be before the opening date.',
      );
    }
  }

  private async save(account: PharmacyAccount): Promise<PharmacyAccount> {
    try {
      return await this.accounts.save(account);
    } catch (error) {
      const { code, message } = error as { code?: string; message?: string };
      if (code === 'ER_DUP_ENTRY') {
        throw new ConflictException(
          message?.includes('uq_pharmacy_accounts_code')
            ? CODE_TAKEN
            : NUMBER_TAKEN,
        );
      }
      throw error;
    }
  }

  private async view(account: PharmacyAccount): Promise<PharmacyAccountView> {
    return (await this.views([account]))[0];
  }

  private async views(
    accounts: PharmacyAccount[],
  ): Promise<PharmacyAccountView[]> {
    const labels = new Map(
      (await this.coa.list()).map((a) => [a.code, a.label]),
    );
    return accounts.map((a) => ({
      id: a.id,
      pharmacyId: a.pharmacyId,
      name: a.name,
      kind: a.kind,
      bank: a.bank,
      lastFour: a.lastFour,
      coaCode: a.coaCode,
      coaLabel: labels.get(a.coaCode) ?? a.coaCode,
      openedOn: a.openedOn,
      closedOn: a.closedOn,
      notes: a.notes,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  }
}
