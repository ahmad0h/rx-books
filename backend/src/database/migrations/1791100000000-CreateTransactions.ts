import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bank and card transactions, and the CSV uploads that created them (Phase 7).
 *
 * Bank files carry no transaction ID, so each row gets a fingerprint
 * (source_row_id, PRD 10.1): a hash of pharmacy, account, date, amount,
 * normalized description and an occurrence number for identical rows in one
 * file. Loading the same rows again is skipped by the unique key.
 * New rows start in 9999 · Uncategorized; categorization comes in Phase 8.
 */
export class CreateTransactions1791100000000 implements MigrationInterface {
  name = 'CreateTransactions1791100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`transaction_uploads\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`pharmacy_id\` int unsigned NOT NULL,
        \`account_id\` int unsigned NOT NULL,
        \`file_name\` varchar(255) NOT NULL,
        \`file_sha256\` char(64) NOT NULL,
        \`format\` varchar(30) NOT NULL,
        \`uploaded_by\` int unsigned NOT NULL,
        \`rows_in_file\` int unsigned NOT NULL,
        \`rows_added\` int unsigned NOT NULL,
        \`rows_skipped\` int unsigned NOT NULL,
        \`rows_held\` int unsigned NOT NULL,
        \`first_date\` date NOT NULL,
        \`last_date\` date NOT NULL,
        \`months\` varchar(400) NOT NULL,
        \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`idx_uploads_pharmacy\` (\`pharmacy_id\`, \`created_at\`),
        CONSTRAINT \`fk_uploads_pharmacy\` FOREIGN KEY (\`pharmacy_id\`) REFERENCES \`pharmacies\` (\`id\`),
        CONSTRAINT \`fk_uploads_account\` FOREIGN KEY (\`account_id\`) REFERENCES \`pharmacy_accounts\` (\`id\`),
        CONSTRAINT \`fk_uploads_user\` FOREIGN KEY (\`uploaded_by\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`transactions\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`pharmacy_id\` int unsigned NOT NULL,
        \`account_id\` int unsigned NOT NULL,
        \`upload_id\` int unsigned NOT NULL,
        \`period\` char(7) NOT NULL,
        \`date\` date NOT NULL,
        \`post_date\` date NULL,
        \`description\` varchar(500) NOT NULL,
        \`memo\` varchar(500) NULL,
        \`amount\` decimal(12,2) NOT NULL,
        \`type_hint\` varchar(40) NULL,
        \`last_four\` char(4) NULL,
        \`signature\` char(64) NOT NULL,
        \`source_row_id\` char(64) NOT NULL,
        \`occurrence\` smallint unsigned NOT NULL,
        \`coa_code\` char(4) NOT NULL DEFAULT '9999',
        \`status\` varchar(20) NOT NULL DEFAULT 'uncategorized',
        \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_transactions_source_row\` (\`source_row_id\`),
        KEY \`idx_transactions_month\` (\`pharmacy_id\`, \`period\`, \`account_id\`),
        KEY \`idx_transactions_signature\` (\`account_id\`, \`signature\`),
        CONSTRAINT \`fk_transactions_pharmacy\` FOREIGN KEY (\`pharmacy_id\`) REFERENCES \`pharmacies\` (\`id\`),
        CONSTRAINT \`fk_transactions_account\` FOREIGN KEY (\`account_id\`) REFERENCES \`pharmacy_accounts\` (\`id\`),
        CONSTRAINT \`fk_transactions_upload\` FOREIGN KEY (\`upload_id\`) REFERENCES \`transaction_uploads\` (\`id\`),
        CONSTRAINT \`fk_transactions_coa\` FOREIGN KEY (\`coa_code\`) REFERENCES \`coa_accounts\` (\`code\`),
        CONSTRAINT \`chk_transactions_period\` CHECK (\`period\` = CONCAT(YEAR(\`date\`), '-', LPAD(MONTH(\`date\`), 2, '0')))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `transactions`');
    await queryRunner.query('DROP TABLE `transaction_uploads`');
  }
}
