import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI suggestions (Phase 9, PRD 8.5): versioned instructions, a log of every
 * AI run with tokens and cost, and the AI's answer on each transaction.
 * AI only ever suggests; a person approves.
 */
const FIRST_PROMPT = `You categorize bank and card transactions for independent US pharmacies into the RxBooks chart of accounts. Staff review every suggestion before it is final, so an honest "9999" is better than a confident wrong answer.

For each transaction, choose the one account a careful pharmacy bookkeeper would pick, from the chart of accounts below. Use 9999 when the description doesn't say enough to decide, for example a bare CHECK, a Zelle payment to a person, or a store purchase that could just as well be personal.

What matters in a pharmacy's books:
- Amounts: negative = money out of the account or a card purchase; positive = money in (deposits, refunds, card payments received).
- Payment words (ZELLE, CHECK, ACH, WEB AUTHORIZED PMT, MOBILE BANKING, TRANSFER) say how money moved, not who received it.
- PBM and insurer deposits are prescription revenue (4010). Card-settlement deposits are patient-pay revenue (4030).
- Mixed-use stores (Amazon, Walmart, Target, Costco warehouse, groceries, coffee shops, restaurants) can be business or personal: judge from the amount and description, and lower your confidence when personal use is plausible.
- Only the last four digits of an account number ever appear. If they match one of the pharmacy's own accounts (listed with each request), the transaction is a transfer to that account's code. Otherwise decide only from what you are given: the owner's personal account is 2510, a separate company with the same owners is 1210, and when you can't tell, use 9999.
- 2510 · Owner draw / personal needs a subtag (personal, distribution or charity) and a short note saying why. For every other account the subtag is "none" and the note is empty.

Confidence is 0 to 100: how likely a careful bookkeeper would choose the same account. Keep each rationale under 120 characters, plain and specific, e.g. "Airline ticket: business travel".`;

export class AddAiSuggestions1791300000000 implements MigrationInterface {
  name = 'AddAiSuggestions1791300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`ai_prompts\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`version\` int unsigned NOT NULL,
        \`body\` mediumtext NOT NULL,
        \`created_by\` int unsigned NULL,
        \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_ai_prompts_version\` (\`version\`),
        CONSTRAINT \`fk_ai_prompts_user\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(
      'INSERT INTO `ai_prompts` (`version`, `body`) VALUES (1, ?)',
      [FIRST_PROMPT],
    );
    await queryRunner.query(`
      CREATE TABLE \`ai_runs\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`pharmacy_id\` int unsigned NOT NULL,
        \`prompt_version\` int unsigned NOT NULL,
        \`model\` varchar(60) NOT NULL,
        \`requested_by\` int unsigned NOT NULL,
        \`rows_sent\` int unsigned NOT NULL,
        \`rows_suggested\` int unsigned NOT NULL,
        \`rows_unplaced\` int unsigned NOT NULL,
        \`batches\` int unsigned NOT NULL,
        \`batches_failed\` int unsigned NOT NULL,
        \`input_tokens\` int unsigned NOT NULL DEFAULT 0,
        \`output_tokens\` int unsigned NOT NULL DEFAULT 0,
        \`cache_write_tokens\` int unsigned NOT NULL DEFAULT 0,
        \`cache_read_tokens\` int unsigned NOT NULL DEFAULT 0,
        \`cost_usd\` decimal(10,4) NULL,
        \`error\` varchar(500) NULL,
        \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`idx_ai_runs_pharmacy\` (\`pharmacy_id\`, \`created_at\`),
        CONSTRAINT \`fk_ai_runs_pharmacy\` FOREIGN KEY (\`pharmacy_id\`) REFERENCES \`pharmacies\` (\`id\`),
        CONSTRAINT \`fk_ai_runs_user\` FOREIGN KEY (\`requested_by\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      ALTER TABLE \`transactions\`
        ADD \`ai_confidence\` tinyint unsigned NULL AFTER \`approved_at\`,
        ADD \`ai_rationale\` varchar(200) NULL AFTER \`ai_confidence\`,
        ADD \`ai_run_id\` int unsigned NULL AFTER \`ai_rationale\`,
        ADD \`subtag\` varchar(20) NULL AFTER \`ai_run_id\`,
        ADD \`subtag_note\` varchar(300) NULL AFTER \`subtag\`,
        ADD CONSTRAINT \`fk_transactions_ai_run\` FOREIGN KEY (\`ai_run_id\`) REFERENCES \`ai_runs\` (\`id\`)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`transactions\`
        DROP FOREIGN KEY \`fk_transactions_ai_run\`,
        DROP COLUMN \`subtag_note\`,
        DROP COLUMN \`subtag\`,
        DROP COLUMN \`ai_run_id\`,
        DROP COLUMN \`ai_rationale\`,
        DROP COLUMN \`ai_confidence\`
    `);
    await queryRunner.query('DROP TABLE `ai_runs`');
    await queryRunner.query('DROP TABLE `ai_prompts`');
  }
}
