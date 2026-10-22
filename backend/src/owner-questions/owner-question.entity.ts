import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * waiting → answered → accepted / overridden; or cancelled at any open step.
 * "waiting" and "answered" are open: at most one open question per transaction.
 */
export const QUESTION_STATUSES = [
  'waiting',
  'answered',
  'accepted',
  'overridden',
  'cancelled',
] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
export const OPEN_STATUSES: readonly QuestionStatus[] = ['waiting', 'answered'];

/** A question to the pharmacy owner about one transaction. */
@Entity({ name: 'owner_questions' })
export class OwnerQuestion {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'pharmacy_id', type: 'int', unsigned: true })
  pharmacyId: number;

  @Column({ name: 'transaction_id', type: 'int', unsigned: true })
  transactionId: number;

  @Column({ name: 'asked_by', type: 'int', unsigned: true })
  askedBy: number;

  @Column({ name: 'asked_at', type: 'datetime', precision: 3 })
  askedAt: Date;

  /** Staff's best guess, shown to the owner as the starting choice. */
  @Column({ name: 'suggested_code', type: 'char', length: 4, nullable: true })
  suggestedCode: string | null;

  @Column({ name: 'staff_note', type: 'varchar', length: 500, nullable: true })
  staffNote: string | null;

  @Column({ type: 'varchar', length: 20, default: 'waiting' })
  status: QuestionStatus;

  /** The owner's pick; null with answerUnsure = "Not sure, you decide". */
  @Column({ name: 'answer_code', type: 'char', length: 4, nullable: true })
  answerCode: string | null;

  @Column({ name: 'answer_unsure', type: 'boolean', default: false })
  answerUnsure: boolean;

  @Column({
    name: 'answer_note',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  answerNote: string | null;

  @Column({ name: 'will_send_document', type: 'boolean', default: false })
  willSendDocument: boolean;

  @Column({ name: 'answered_by', type: 'int', unsigned: true, nullable: true })
  answeredBy: number | null;

  @Column({
    name: 'answered_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  answeredAt: Date | null;

  @Column({ name: 'resolved_by', type: 'int', unsigned: true, nullable: true })
  resolvedBy: number | null;

  @Column({
    name: 'resolved_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  resolvedAt: Date | null;
}
