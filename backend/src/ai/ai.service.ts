import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { UNCATEGORIZED_CODE } from '../coa/coa-account.entity.js';
import { CoaService } from '../coa/coa.service.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { BankTransaction } from '../transactions/bank-transaction.entity.js';
import { UsersService } from '../users/users.service.js';
import { AiPrompt } from './ai-prompt.entity.js';
import {
  allowedAccounts,
  BATCH_SIZE,
  buildSystem,
  buildUser,
  chunk,
  estimateCost,
  parseAnswer,
  responseSchema,
  type TokenUsage,
} from './ai-request.js';
import { AiRun } from './ai-run.entity.js';
import { ClaudeClient, describeAiError } from './claude.client.js';

export const AI_NOT_SET_UP =
  'AI is not set up. Add ANTHROPIC_API_KEY to the backend .env file and restart.';
export const NOTHING_FOR_AI =
  'None of the chosen rows can go to AI: only uncategorized rows and earlier AI suggestions can (approved rows and rule or staff decisions stay as they are).';

export interface AskAiResult {
  runId: number;
  sent: number;
  suggested: number;
  /** Left in 9999: the AI couldn't place them, or its answer was invalid. */
  unplaced: number;
  /** Chosen rows that can't go to AI (approved, or decided by a rule or a person). */
  skipped: number;
  batches: number;
  batchesFailed: number;
  costUsd: string | null;
  error: string | null;
}

export interface AiStatus {
  enabled: boolean;
  model: string;
  promptVersion: number;
}

export interface PromptView {
  version: number;
  body: string;
  createdBy: string;
  createdAt: Date;
}

export interface AiRunView {
  id: number;
  pharmacyId: number;
  promptVersion: number;
  model: string;
  requestedBy: string;
  rowsSent: number;
  rowsSuggested: number;
  rowsUnplaced: number;
  batches: number;
  batchesFailed: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: string | null;
  error: string | null;
  createdAt: Date;
}

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(AiPrompt)
    private readonly prompts: Repository<AiPrompt>,
    @InjectRepository(AiRun)
    private readonly runs: Repository<AiRun>,
    @InjectRepository(BankTransaction)
    private readonly transactions: Repository<BankTransaction>,
    @InjectRepository(PharmacyAccount)
    private readonly accounts: Repository<PharmacyAccount>,
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    private readonly coa: CoaService,
    private readonly users: UsersService,
    private readonly claude: ClaudeClient,
  ) {}

  async status(): Promise<AiStatus> {
    return {
      enabled: this.claude.enabled,
      model: this.claude.model,
      promptVersion: (await this.latestPrompt()).version,
    };
  }

  /** Every version, newest first. */
  async listPrompts(): Promise<PromptView[]> {
    const rows = (await this.prompts.find({ where: {} })).sort(
      (a, b) => b.version - a.version,
    );
    const names = await this.names(
      rows.flatMap((p) => (p.createdBy ? [p.createdBy] : [])),
    );
    return rows.map((p) => ({
      version: p.version,
      body: p.body,
      createdBy: p.createdBy
        ? (names.get(p.createdBy) ?? 'Unknown user')
        : 'RxBooks (built in)',
      createdAt: p.createdAt,
    }));
  }

  /** Saving never overwrites: it adds the next version. */
  async savePrompt(body: string, userId: number): Promise<PromptView> {
    const latest = await this.latestPrompt();
    if (latest.body.trim() === body.trim()) {
      throw new BadRequestException(
        'Nothing changed: this is the current version.',
      );
    }
    const saved = await this.prompts.save(
      this.prompts.create({
        version: latest.version + 1,
        body,
        createdBy: userId,
      }),
    );
    return (await this.listPrompts()).find((p) => p.version === saved.version)!;
  }

  /** AI runs, newest first; optionally for one pharmacy. */
  async listRuns(pharmacyId?: number): Promise<AiRunView[]> {
    const rows = (
      await this.runs.find({ where: pharmacyId ? { pharmacyId } : {} })
    ).sort((a, b) => b.id - a.id);
    const names = await this.names(rows.map((r) => r.requestedBy));
    return rows.map((r) => ({
      id: r.id,
      pharmacyId: r.pharmacyId,
      promptVersion: r.promptVersion,
      model: r.model,
      requestedBy: names.get(r.requestedBy) ?? 'Unknown user',
      rowsSent: r.rowsSent,
      rowsSuggested: r.rowsSuggested,
      rowsUnplaced: r.rowsUnplaced,
      batches: r.batches,
      batchesFailed: r.batchesFailed,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheWriteTokens: r.cacheWriteTokens,
      cacheReadTokens: r.cacheReadTokens,
      costUsd: r.costUsd,
      error: r.error,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Sends the chosen rows that are uncategorized or AI-suggested to Claude, in
   * batches of 40. Each answer becomes a "to confirm" suggestion; AI never approves.
   */
  async suggest(
    pharmacyId: number,
    ids: number[],
    userId: number,
  ): Promise<AskAiResult> {
    if (!this.claude.enabled)
      throw new ServiceUnavailableException(AI_NOT_SET_UP);
    if (!(await this.pharmacies.existsBy({ id: pharmacyId }))) {
      throw new NotFoundException('Pharmacy not found.');
    }
    const chosen = await this.transactions.find({
      where: { pharmacyId, id: In(ids) },
    });
    if (chosen.length !== new Set(ids).size) {
      throw new NotFoundException('Some transactions were not found.');
    }
    const rows = chosen
      .filter(
        (t) =>
          t.status !== 'approved' && (t.source === null || t.source === 'ai'),
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    if (rows.length === 0) throw new BadRequestException(NOTHING_FOR_AI);

    const prompt = await this.latestPrompt();
    const coa = await this.coa.list();
    const codes = allowedAccounts(coa).map((a) => a.code);
    const labels = new Map(coa.map((a) => [a.code, a.label]));
    const own = (await this.accounts.find({ where: { pharmacyId } }))
      .sort((a, b) => a.coaCode.localeCompare(b.coaCode))
      .map((a) => ({
        coaCode: a.coaCode,
        coaLabel: labels.get(a.coaCode) ?? a.coaCode,
        name: a.name,
        bank: a.bank,
        lastFour: a.lastFour,
      }));
    const system = buildSystem(prompt.body, coa);
    const schema = responseSchema(codes);

    const batches = chunk(rows, BATCH_SIZE);
    const run = await this.runs.save(
      this.runs.create({
        pharmacyId,
        promptVersion: prompt.version,
        model: this.claude.model,
        requestedBy: userId,
        rowsSent: rows.length,
        rowsSuggested: 0,
        rowsUnplaced: 0,
        batches: batches.length,
        batchesFailed: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        costUsd: null,
        error: null,
      }),
    );

    const usage: TokenUsage = {
      input: 0,
      output: 0,
      cacheWrite: 0,
      cacheRead: 0,
    };
    let cost: number | null = 0;
    let suggested = 0;
    let unplaced = 0;
    let failed = 0;
    let error: string | null = null;

    for (const batch of batches) {
      try {
        const answer = await this.claude.classify({
          system,
          user: buildUser(
            own,
            batch.map((t) => ({
              id: t.id,
              date: t.date,
              description: t.description,
              memo: t.memo,
              amount: t.amount,
              lastFour: t.lastFour,
            })),
          ),
          schema,
        });
        usage.input += answer.usage.input;
        usage.output += answer.usage.output;
        usage.cacheWrite += answer.usage.cacheWrite;
        usage.cacheRead += answer.usage.cacheRead;
        const batchCost = estimateCost(answer.model, answer.usage);
        cost = cost === null || batchCost === null ? null : cost + batchCost;

        if (answer.text === null) {
          failed += 1;
          unplaced += batch.length;
          error ??= 'AI declined to answer this batch.';
          continue;
        }
        const suggestions = parseAnswer(
          answer.text,
          batch.map((t) => t.id),
          codes,
        );
        for (const row of batch) {
          const s = suggestions.get(row.id);
          if (!s) {
            unplaced += 1;
            continue;
          }
          const placed = s.category !== UNCATEGORIZED_CODE;
          Object.assign(row, {
            coaCode: s.category,
            status: placed ? 'suggested' : 'uncategorized',
            source: placed ? 'ai' : null,
            ruleId: null,
            approvedBy: null,
            approvedAt: null,
            aiConfidence: s.confidence,
            aiRationale: s.rationale || null,
            aiRunId: run.id,
            subtag: s.subtag,
            subtagNote: s.subtagNote,
          });
          if (placed) suggested += 1;
          else unplaced += 1;
        }
        await this.transactions.save(batch);
      } catch (err) {
        failed += 1;
        unplaced += batch.length;
        error ??= describeAiError(err);
      }
    }

    Object.assign(run, {
      rowsSuggested: suggested,
      rowsUnplaced: unplaced,
      batchesFailed: failed,
      inputTokens: usage.input,
      outputTokens: usage.output,
      cacheWriteTokens: usage.cacheWrite,
      cacheReadTokens: usage.cacheRead,
      costUsd: cost === null ? null : cost.toFixed(4),
      error,
    });
    await this.runs.save(run);
    return {
      runId: run.id,
      sent: rows.length,
      suggested,
      unplaced,
      skipped: chosen.length - rows.length,
      batches: batches.length,
      batchesFailed: failed,
      costUsd: run.costUsd,
      error,
    };
  }

  private async latestPrompt(): Promise<AiPrompt> {
    const all = await this.prompts.find({ where: {} });
    const latest = all.sort((a, b) => b.version - a.version)[0];
    if (!latest)
      throw new ServiceUnavailableException('The AI instructions are missing.');
    return latest;
  }

  private async names(ids: number[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    for (const id of new Set(ids)) {
      names.set(id, (await this.users.findById(id))?.name ?? 'Unknown user');
    }
    return names;
  }
}
