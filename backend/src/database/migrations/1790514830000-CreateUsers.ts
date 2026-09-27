import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1790514830000 implements MigrationInterface {
  name = 'CreateUsers1790514830000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`email\` varchar(254) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`password_hash\` varchar(255) NOT NULL,
        \`role\` enum('admin', 'client') NOT NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`last_login_at\` datetime(3) NULL,
        \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_users_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `users`');
  }
}
