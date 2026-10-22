import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One version of the AI's instructions. Saving creates a new version; old ones stay. */
@Entity({ name: 'ai_prompts' })
export class AiPrompt {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'int', unsigned: true, unique: true })
  version: number;

  @Column({ type: 'mediumtext' })
  body: string;

  /** Null for the version shipped with the app. */
  @Column({ name: 'created_by', type: 'int', unsigned: true, nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
