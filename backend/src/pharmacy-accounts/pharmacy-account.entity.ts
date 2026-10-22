import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const ACCOUNT_KINDS = ['checking', 'savings', 'credit_card'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

/** One of a pharmacy's own bank or card accounts. */
@Entity({ name: 'pharmacy_accounts' })
export class PharmacyAccount {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'pharmacy_id', type: 'int', unsigned: true })
  pharmacyId: number;

  /** What staff call it, e.g. "Main operating checking". */
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'enum', enum: ACCOUNT_KINDS })
  kind: AccountKind;

  /** As the bank names itself on the statement, e.g. "US Bank". */
  @Column({ type: 'varchar', length: 80 })
  bank: string;

  /** Only the last four digits are ever stored. */
  @Column({ name: 'last_four', type: 'char', length: 4 })
  lastFour: string;

  /** Where its transactions land, e.g. 1010 or 2010. One account per code per pharmacy. */
  @Column({ name: 'coa_code', type: 'char', length: 4 })
  coaCode: string;

  /** "YYYY-MM-DD" */
  @Column({ name: 'opened_on', type: 'date', nullable: true })
  openedOn: string | null;

  /** Set when the account is closed. Closed accounts take no new uploads. */
  @Column({ name: 'closed_on', type: 'date', nullable: true })
  closedOn: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}

/** An account as the API returns it, with its chart-of-accounts label. */
export interface PharmacyAccountView {
  id: number;
  pharmacyId: number;
  name: string;
  kind: AccountKind;
  bank: string;
  lastFour: string;
  coaCode: string;
  /** "1010 · Cash — checking 1" */
  coaLabel: string;
  openedOn: string | null;
  closedOn: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
