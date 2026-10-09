import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePharmacies1790600000000 implements MigrationInterface {
  name = 'CreatePharmacies1790600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`pharmacies\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(160) NOT NULL,
        \`owner_name\` varchar(120) NOT NULL,
        \`owner_phone\` varchar(32) NOT NULL,
        \`owner_email\` varchar(254) NOT NULL,
        \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_pharmacies_name\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    // Client users belong to one pharmacy; admins have none.
    await queryRunner.query(`
      ALTER TABLE \`users\`
        ADD \`pharmacy_id\` int unsigned NULL AFTER \`role\`,
        ADD KEY \`ix_users_pharmacy_id\` (\`pharmacy_id\`),
        ADD CONSTRAINT \`fk_users_pharmacy\` FOREIGN KEY (\`pharmacy_id\`)
          REFERENCES \`pharmacies\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` DROP FOREIGN KEY `fk_users_pharmacy`, DROP KEY `ix_users_pharmacy_id`, DROP COLUMN `pharmacy_id`',
    );
    await queryRunner.query('DROP TABLE `pharmacies`');
  }
}
