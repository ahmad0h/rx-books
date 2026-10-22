import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds 1030 · Cash — checking 2, so a pharmacy can have a second checking
 * account (PRD 8.8: checking and savings use 1000–1099). Skipped if an
 * account with this code or name was already added in the admin screen.
 */
export class AddSecondChecking1791000000000 implements MigrationInterface {
  name = 'AddSecondChecking1791000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO \`coa_accounts\` (\`code\`, \`name\`, \`type\`, \`expense_group\`, \`owner_label\`, \`categorizable\`, \`description\`)
       SELECT ?, ?, 'asset', NULL, ?, 1, ?
       WHERE NOT EXISTS (SELECT 1 FROM \`coa_accounts\` WHERE \`code\` = ? OR \`name\` = ?)`,
      [
        '1030',
        'Cash — checking 2',
        'Second checking account',
        "A pharmacy's second checking account (e.g. a separate payroll or deposit account). Transfers between it and 1010 are balance-sheet movements, not income or expenses. Which bank it is is recorded per pharmacy.",
        '1030',
        'Cash — checking 2',
      ],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `coa_accounts` WHERE `code` = '1030' AND `name` = 'Cash — checking 2'",
    );
  }
}
