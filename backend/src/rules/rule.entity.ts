import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Where a rule came from. `import` = the pilot's Google Sheet; `manual` = added
 * in the admin screen. Later phases add rules from AI review and client answers.
 */
export const RULE_SOURCES = [
  'import',
  'manual',
  'ai_review',
  'client_confirmed',
] as const;
export type RuleSource = (typeof RULE_SOURCES)[number];

/** "If the bank description contains KEYWORD, use account X." */
@Entity({ name: 'rules' })
export class Rule {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  /** null = shared rule, used for every pharmacy. */
  @Column({ name: 'pharmacy_id', type: 'int', unsigned: true, nullable: true })
  pharmacyId: number | null;

  /** Upper-case, single spaces. Matched at the start of a word. */
  @Column({ type: 'varchar', length: 120 })
  keyword: string;

  @Column({ name: 'coa_code', type: 'char', length: 4 })
  coaCode: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  tag: string | null;

  /** Lower runs first. */
  @Column({ type: 'int' })
  priority: number;

  /** When false, a match is only a suggestion that staff confirm. */
  @Column({ name: 'auto_approve', type: 'boolean', default: true })
  autoApprove: boolean;

  @Column({ type: 'varchar', length: 20 })
  source: RuleSource;

  @Column({
    name: 'source_note',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  sourceNote: string | null;

  /** Never changes; breaks ties between equal rules (oldest wins). */
  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    update: false,
  })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  /** Set instead of deleting. A retired rule never matches. */
  @Column({
    name: 'retired_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  retiredAt: Date | null;
}

/** A rule as the API returns it, with its account label. */
export interface RuleView {
  id: number;
  pharmacyId: number | null;
  keyword: string;
  coaCode: string;
  /** "5010 · Rx drugs — wholesale" */
  account: string;
  tag: string | null;
  priority: number;
  autoApprove: boolean;
  source: RuleSource;
  sourceNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  retiredAt: Date | null;
}
