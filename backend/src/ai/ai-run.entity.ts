import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One click on "Ask AI": what was sent, what came back, and what it cost. */
@Entity({ name: 'ai_runs' })
export class AiRun {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'pharmacy_id', type: 'int', unsigned: true })
  pharmacyId: number;

  @Column({ name: 'prompt_version', type: 'int', unsigned: true })
  promptVersion: number;

  @Column({ type: 'varchar', length: 60 })
  model: string;

  @Column({ name: 'requested_by', type: 'int', unsigned: true })
  requestedBy: number;

  @Column({ name: 'rows_sent', type: 'int', unsigned: true })
  rowsSent: number;

  /** Rows that got an account. */
  @Column({ name: 'rows_suggested', type: 'int', unsigned: true })
  rowsSuggested: number;

  /** Rows the AI left in 9999, or whose answer was invalid or missing. */
  @Column({ name: 'rows_unplaced', type: 'int', unsigned: true })
  rowsUnplaced: number;

  @Column({ type: 'int', unsigned: true })
  batches: number;

  @Column({ name: 'batches_failed', type: 'int', unsigned: true })
  batchesFailed: number;

  @Column({ name: 'input_tokens', type: 'int', unsigned: true, default: 0 })
  inputTokens: number;

  @Column({ name: 'output_tokens', type: 'int', unsigned: true, default: 0 })
  outputTokens: number;

  @Column({
    name: 'cache_write_tokens',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  cacheWriteTokens: number;

  @Column({
    name: 'cache_read_tokens',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  cacheReadTokens: number;

  /** Estimated from list prices; null for a model without a known price. */
  @Column({
    name: 'cost_usd',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  costUsd: string | null;

  /** The first problem, when a batch failed. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
