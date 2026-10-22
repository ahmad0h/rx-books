import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Each pharmacy's own bank and card accounts (PRD 7.4 O1–O3).
 * Only the last four digits of an account number are ever stored.
 * Accounts are closed (closed_on), never deleted.
 */
export class CreatePharmacyAccounts1790900000000 implements MigrationInterface {
  name = 'CreatePharmacyAccounts1790900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`pharmacy_accounts\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`pharmacy_id\` int unsigned NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`kind\` enum('checking','savings','credit_card') NOT NULL,
        \`bank\` varchar(80) NOT NULL,
        \`last_four\` char(4) NOT NULL,
        \`coa_code\` char(4) NOT NULL,
        \`opened_on\` date NULL,
        \`closed_on\` date NULL,
        \`notes\` varchar(1000) NULL,
        \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_pharmacy_accounts_code\` (\`pharmacy_id\`, \`coa_code\`),
        UNIQUE KEY \`uq_pharmacy_accounts_number\` (\`pharmacy_id\`, \`bank\`, \`last_four\`),
        CONSTRAINT \`fk_pharmacy_accounts_pharmacy\` FOREIGN KEY (\`pharmacy_id\`) REFERENCES \`pharmacies\` (\`id\`),
        CONSTRAINT \`fk_pharmacy_accounts_coa\` FOREIGN KEY (\`coa_code\`) REFERENCES \`coa_accounts\` (\`code\`),
        CONSTRAINT \`chk_pharmacy_accounts_last_four\` CHECK (\`last_four\` REGEXP '^[0-9]{4}$'),
        CONSTRAINT \`chk_pharmacy_accounts_dates\` CHECK (\`closed_on\` IS NULL OR \`opened_on\` IS NULL OR \`closed_on\` >= \`opened_on\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `pharmacy_accounts`');
  }
}
