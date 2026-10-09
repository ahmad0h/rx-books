import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const USER_ROLES = ['admin', 'client'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  /** Stored lower-case; unique. */
  @Column({ type: 'varchar', length: 254, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** argon2id hash. Never returned unless explicitly selected. */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;

  /** Goes up by one on every password change; older session tokens stop working. */
  @Column({ name: 'session_version', type: 'int', unsigned: true, default: 0 })
  sessionVersion: number;

  /** When the password was last changed (for the record). */
  @Column({
    name: 'password_changed_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  passwordChangedAt: Date | null;

  @Column({ type: 'enum', enum: USER_ROLES })
  role: UserRole;

  /** The pharmacy a client user belongs to. Empty for admins. */
  @Column({ name: 'pharmacy_id', type: 'int', unsigned: true, nullable: true })
  pharmacyId: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'last_login_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
