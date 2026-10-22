import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Where a transaction is in categorization:
 * uncategorized = still in 9999; suggested = has an account a person must confirm;
 * approved = final (by an auto-approve rule or a person).
 */
export const TRANSACTION_STATUSES = [
  'uncategorized',
  'suggested',
  'approved',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** How the account was chosen ("owner" = the owner's answer, accepted by staff). */
export const TRANSACTION_SOURCES = [
  'rule',
  'own_account',
  'ai',
  'staff',
  'owner',
] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

/** Kinds of owner draw (2510), PRD 8.5. */
export const SUBTAGS = ['personal', 'distribution', 'charity'] as const;
export type Subtag = (typeof SUBTAGS)[number];

/** Something a person should look at, whatever the account. */
export const TRANSACTION_FLAGS = ['unknown_account'] as const;
export type TransactionFlag = (typeof TRANSACTION_FLAGS)[number];

/** One row from a bank or card CSV. */
@Entity({ name: 'transactions' })
export class BankTransaction {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'pharmacy_id', type: 'int', unsigned: true })
  pharmacyId: number;

  @Column({ name: 'account_id', type: 'int', unsigned: true })
  accountId: number;

  @Column({ name: 'upload_id', type: 'int', unsigned: true })
  uploadId: number;

  /** "YYYY-MM", always the month of `date`. */
  @Column({ type: 'char', length: 7 })
  period: string;

  /** "YYYY-MM-DD" */
  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'post_date', type: 'date', nullable: true })
  postDate: string | null;

  /** As in the file. */
  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  memo: string | null;

  /** Exact decimal as a string, e.g. "-3120.40". Negative = money out. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /** The bank's own label, e.g. "DEBIT" or "Sale". */
  @Column({ name: 'type_hint', type: 'varchar', length: 40, nullable: true })
  typeHint: string | null;

  /** Last four digits of a masked account number in the description, if any. */
  @Column({ name: 'last_four', type: 'char', length: 4, nullable: true })
  lastFour: string | null;

  /** Hash of pharmacy, account, date, amount and description (no occurrence). */
  @Column({ type: 'char', length: 64 })
  signature: string;

  /** Permanent row identity (PRD 10.1): the signature plus the occurrence. */
  @Column({ name: 'source_row_id', type: 'char', length: 64, unique: true })
  sourceRowId: string;

  /** 1, 2, 3… for identical rows within one file. */
  @Column({ type: 'smallint', unsigned: true })
  occurrence: number;

  @Column({ name: 'coa_code', type: 'char', length: 4, default: '9999' })
  coaCode: string;

  @Column({ type: 'varchar', length: 20, default: 'uncategorized' })
  status: TransactionStatus;

  /** Null while uncategorized. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  source: TransactionSource | null;

  /** The rule that chose the account, when source is "rule". */
  @Column({ name: 'rule_id', type: 'int', unsigned: true, nullable: true })
  ruleId: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  flag: TransactionFlag | null;

  /** The person who approved it; null when an auto-approve rule did. */
  @Column({ name: 'approved_by', type: 'int', unsigned: true, nullable: true })
  approvedBy: number | null;

  @Column({
    name: 'approved_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  approvedAt: Date | null;

  /** 0–100, when the AI suggested the account. */
  @Column({
    name: 'ai_confidence',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  aiConfidence: number | null;

  /** The AI's short reason, when it suggested the account. */
  @Column({
    name: 'ai_rationale',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  aiRationale: string | null;

  @Column({ name: 'ai_run_id', type: 'int', unsigned: true, nullable: true })
  aiRunId: number | null;

  /** Only for 2510 · Owner draw: personal, distribution or charity. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  subtag: Subtag | null;

  @Column({ name: 'subtag_note', type: 'varchar', length: 300, nullable: true })
  subtagNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
