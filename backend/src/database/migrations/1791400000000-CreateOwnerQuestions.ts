import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owner questions (Phase 10, PRD 8.6): staff ask the pharmacy owner about a
 * transaction; the owner's answer is only a suggestion until staff accept it.
 * At most one open question (waiting or answered) per transaction.
 */
export class CreateOwnerQuestions1791400000000 implements MigrationInterface {
  name = 'CreateOwnerQuestions1791400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`owner_questions\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`pharmacy_id\` int unsigned NOT NULL,
        \`transaction_id\` int unsigned NOT NULL,
        \`asked_by\` int unsigned NOT NULL,
        \`asked_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`suggested_code\` char(4) NULL,
        \`staff_note\` varchar(500) NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'waiting',
        \`answer_code\` char(4) NULL,
        \`answer_unsure\` tinyint(1) NOT NULL DEFAULT 0,
        \`answer_note\` varchar(1000) NULL,
        \`will_send_document\` tinyint(1) NOT NULL DEFAULT 0,
        \`answered_by\` int unsigned NULL,
        \`answered_at\` datetime(3) NULL,
        \`resolved_by\` int unsigned NULL,
        \`resolved_at\` datetime(3) NULL,
        \`open_flag\` tinyint AS (IF(\`status\` IN ('waiting', 'answered'), 1, NULL)) STORED,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_owner_questions_open\` (\`transaction_id\`, \`open_flag\`),
        KEY \`idx_owner_questions_pharmacy\` (\`pharmacy_id\`, \`status\`),
        CONSTRAINT \`fk_owner_questions_pharmacy\` FOREIGN KEY (\`pharmacy_id\`) REFERENCES \`pharmacies\` (\`id\`),
        CONSTRAINT \`fk_owner_questions_transaction\` FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\` (\`id\`),
        CONSTRAINT \`fk_owner_questions_asked_by\` FOREIGN KEY (\`asked_by\`) REFERENCES \`users\` (\`id\`),
        CONSTRAINT \`fk_owner_questions_answered_by\` FOREIGN KEY (\`answered_by\`) REFERENCES \`users\` (\`id\`),
        CONSTRAINT \`fk_owner_questions_resolved_by\` FOREIGN KEY (\`resolved_by\`) REFERENCES \`users\` (\`id\`),
        CONSTRAINT \`fk_owner_questions_suggested\` FOREIGN KEY (\`suggested_code\`) REFERENCES \`coa_accounts\` (\`code\`),
        CONSTRAINT \`fk_owner_questions_answer\` FOREIGN KEY (\`answer_code\`) REFERENCES \`coa_accounts\` (\`code\`),
        CONSTRAINT \`chk_owner_questions_status\` CHECK (\`status\` IN ('waiting', 'answered', 'accepted', 'overridden', 'cancelled'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `owner_questions`');
  }
}
