import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  CoaAccount,
  toCoaView,
  UNCATEGORIZED_CODE,
  type CoaAccountView,
} from './coa-account.entity.js';
import type {
  CoaFieldsInput,
  CreateCoaInput,
  UpdateCoaInput,
} from './coa.input.js';

export const DUPLICATE_ACCOUNT_NAME = 'Another account already has this name.';
export const UNCATEGORIZED_LOCKED =
  '9999 · Uncategorized must stay active and open for transactions.';

@Injectable()
export class CoaService {
  constructor(
    @InjectRepository(CoaAccount)
    private readonly accounts: Repository<CoaAccount>,
  ) {}

  async list(): Promise<CoaAccountView[]> {
    const rows = await this.accounts.find({ order: { code: 'ASC' } });
    return rows.map(toCoaView);
  }

  async get(code: string): Promise<CoaAccountView> {
    return toCoaView(await this.find(code));
  }

  async create(input: CreateCoaInput): Promise<CoaAccountView> {
    if (await this.accounts.existsBy({ code: input.code })) {
      throw new ConflictException(
        `An account with code ${input.code} already exists.`,
      );
    }
    await this.checkFields(input.code, input);
    const account = this.accounts.create({
      code: input.code,
      ...this.fields(input),
      isActive: true,
    });
    return toCoaView(await this.save(account));
  }

  async update(code: string, input: UpdateCoaInput): Promise<CoaAccountView> {
    const account = await this.find(code);
    if (
      code === UNCATEGORIZED_CODE &&
      (!input.isActive || !input.categorizable)
    ) {
      throw new BadRequestException(UNCATEGORIZED_LOCKED);
    }
    await this.checkFields(code, input);
    Object.assign(account, this.fields(input), { isActive: input.isActive });
    return toCoaView(await this.save(account));
  }

  private async find(code: string): Promise<CoaAccount> {
    const account = await this.accounts.findOneBy({ code });
    if (!account) throw new NotFoundException(`Account ${code} not found.`);
    return account;
  }

  /** Only the fields a person sets; the group is kept only for expenses. */
  private fields(input: CoaFieldsInput) {
    return {
      name: input.name,
      type: input.type,
      expenseGroup: input.type === 'expense' ? input.expenseGroup : null,
      description: input.description ?? null,
      ownerLabel: input.ownerLabel ?? null,
      categorizable: input.categorizable,
      contraOf: input.contraOf ?? null,
    };
  }

  private async checkFields(code: string, input: CoaFieldsInput) {
    const sameName = await this.accounts.findOne({
      where: { name: input.name },
    });
    if (sameName && sameName.code !== code) {
      throw new ConflictException(DUPLICATE_ACCOUNT_NAME);
    }
    if (input.contraOf) {
      if (input.contraOf === code) {
        throw new BadRequestException('An account cannot offset itself.');
      }
      if (!(await this.accounts.existsBy({ code: input.contraOf }))) {
        throw new BadRequestException(
          `The offset account ${input.contraOf} does not exist.`,
        );
      }
    }
  }

  private async save(account: CoaAccount): Promise<CoaAccount> {
    try {
      return await this.accounts.save(account);
    } catch (error) {
      const { code, message } = error as { code?: string; message?: string };
      if (code === 'ER_DUP_ENTRY') {
        throw new ConflictException(
          message?.includes('PRIMARY')
            ? `An account with code ${account.code} already exists.`
            : DUPLICATE_ACCOUNT_NAME,
        );
      }
      throw error;
    }
  }
}
