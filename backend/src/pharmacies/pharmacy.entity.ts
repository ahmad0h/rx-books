import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A client pharmacy and its owner's contact details. */
@Entity({ name: 'pharmacies' })
export class Pharmacy {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  /** Unique (case-insensitive). */
  @Column({ type: 'varchar', length: 160, unique: true })
  name: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 120 })
  ownerName: string;

  @Column({ name: 'owner_phone', type: 'varchar', length: 32 })
  ownerPhone: string;

  /** Stored lower-case. Used later to invite the owner to the client console. */
  @Column({ name: 'owner_email', type: 'varchar', length: 254 })
  ownerEmail: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
