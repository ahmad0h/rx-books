import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const ACCOUNT_TYPES = [
  'revenue',
  'cost_of_goods',
  'expense',
  'asset',
  'liability',
  'equity',
  'review',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Sub-groups used only for expense accounts. */
export const EXPENSE_GROUPS = [
  'Labor',
  'Occupancy',
  'Regulatory',
  'Professional',
  'General',
] as const;
export type ExpenseGroup = (typeof EXPENSE_GROUPS)[number];

/** The account every transaction lands in until someone categorizes it. */
export const UNCATEGORIZED_CODE = '9999';

/** One account in the chart of accounts, shared by every pharmacy. */
@Entity({ name: 'coa_accounts' })
export class CoaAccount {
  /** Four digits, e.g. "6110". Never changes once created. */
  @PrimaryColumn({ type: 'char', length: 4 })
  code: string;

  /** Unique. Shown as "6110 · Rent" together with the code. */
  @Column({ type: 'varchar', length: 120, unique: true })
  name: string;

  @Column({ type: 'enum', enum: ACCOUNT_TYPES })
  type: AccountType;

  /** Only for expense accounts. */
  @Column({
    name: 'expense_group',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  expenseGroup: ExpenseGroup | null;

  /** What belongs here, in plain words. Helps staff (and later the AI). */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  /** Plain-language name shown to pharmacy owners, e.g. "Rent". */
  @Column({ name: 'owner_label', type: 'varchar', length: 120, nullable: true })
  ownerLabel: string | null;

  /** False for accounts that never hold transactions (e.g. accumulated depreciation). */
  @Column({ type: 'boolean', default: true })
  categorizable: boolean;

  /** For contra accounts: the account this one offsets (5090 offsets 5010). */
  @Column({ name: 'contra_of', type: 'char', length: 4, nullable: true })
  contraOf: string | null;

  /** Accounts are deactivated, never deleted: old transactions keep their code. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}

/** What the API returns: the stored fields plus the display label. */
export interface CoaAccountView {
  code: string;
  label: string;
  name: string;
  type: AccountType;
  expenseGroup: ExpenseGroup | null;
  description: string | null;
  ownerLabel: string | null;
  categorizable: boolean;
  contraOf: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toCoaView(a: CoaAccount): CoaAccountView {
  return {
    code: a.code,
    label: `${a.code} · ${a.name}`,
    name: a.name,
    type: a.type,
    expenseGroup: a.expenseGroup,
    description: a.description,
    ownerLabel: a.ownerLabel,
    categorizable: a.categorizable,
    contraOf: a.contraOf,
    isActive: a.isActive,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
