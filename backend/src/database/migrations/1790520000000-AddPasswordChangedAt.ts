import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordChangedAt1790520000000 implements MigrationInterface {
  name = 'AddPasswordChangedAt1790520000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD `password_changed_at` datetime(3) NULL AFTER `password_hash`, ' +
        'ADD `session_version` int unsigned NOT NULL DEFAULT 0 AFTER `password_changed_at`',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `session_version`, DROP COLUMN `password_changed_at`',
    );
  }
}
