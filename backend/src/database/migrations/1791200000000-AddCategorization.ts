import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categorization (Phase 8): how each transaction got its account, which rule
 * did it, an optional flag for review, and who approved it.
 */
export class AddCategorization1791200000000 implements MigrationInterface {
  name = 'AddCategorization1791200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`transactions\`
        ADD \`source\` varchar(20) NULL AFTER \`status\`,
        ADD \`rule_id\` int unsigned NULL AFTER \`source\`,
        ADD \`flag\` varchar(30) NULL AFTER \`rule_id\`,
        ADD \`approved_by\` int unsigned NULL AFTER \`flag\`,
        ADD \`approved_at\` datetime(3) NULL AFTER \`approved_by\`,
        ADD KEY \`idx_transactions_status\` (\`pharmacy_id\`, \`status\`),
        ADD CONSTRAINT \`fk_transactions_rule\` FOREIGN KEY (\`rule_id\`) REFERENCES \`rules\` (\`id\`),
        ADD CONSTRAINT \`fk_transactions_approver\` FOREIGN KEY (\`approved_by\`) REFERENCES \`users\` (\`id\`)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`transactions\`
        DROP FOREIGN KEY \`fk_transactions_approver\`,
        DROP FOREIGN KEY \`fk_transactions_rule\`,
        DROP KEY \`idx_transactions_status\`,
        DROP COLUMN \`approved_at\`,
        DROP COLUMN \`approved_by\`,
        DROP COLUMN \`flag\`,
        DROP COLUMN \`rule_id\`,
        DROP COLUMN \`source\`
    `);
  }
}
