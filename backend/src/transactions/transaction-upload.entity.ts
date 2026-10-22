import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One imported bank or card CSV. The file itself is not kept. */
@Entity({ name: 'transaction_uploads' })
export class TransactionUpload {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'pharmacy_id', type: 'int', unsigned: true })
  pharmacyId: number;

  @Column({ name: 'account_id', type: 'int', unsigned: true })
  accountId: number;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  /** Fingerprint of the file's content, to recognise the same file later. */
  @Column({ name: 'file_sha256', type: 'char', length: 64 })
  fileSha256: string;

  /** Which bank format read it, e.g. "usbank_checking". */
  @Column({ type: 'varchar', length: 30 })
  format: string;

  @Column({ name: 'uploaded_by', type: 'int', unsigned: true })
  uploadedBy: number;

  @Column({ name: 'rows_in_file', type: 'int', unsigned: true })
  rowsInFile: number;

  @Column({ name: 'rows_added', type: 'int', unsigned: true })
  rowsAdded: number;

  /** Already loaded by an earlier upload. */
  @Column({ name: 'rows_skipped', type: 'int', unsigned: true })
  rowsSkipped: number;

  /** Not imported: identical-row counts differ from what is stored (PRD 10.1). */
  @Column({ name: 'rows_held', type: 'int', unsigned: true })
  rowsHeld: number;

  /** "YYYY-MM-DD" */
  @Column({ name: 'first_date', type: 'date' })
  firstDate: string;

  @Column({ name: 'last_date', type: 'date' })
  lastDate: string;

  /** Months in the file, comma-separated: "2025-01,2025-02". */
  @Column({ type: 'varchar', length: 400 })
  months: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
