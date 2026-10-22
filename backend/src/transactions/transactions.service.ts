import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CoaService } from '../coa/coa.service.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import {
  BankTransaction,
  type TransactionStatus,
} from './bank-transaction.entity.js';
import { centsToDecimal, parseCents } from './money.js';
import { TransactionUpload } from './transaction-upload.entity.js';

export interface TransactionView {
  id: number;
  accountId: number;
  uploadId: number;
  date: string;
  postDate: string | null;
  description: string;
  memo: string | null;
  amount: string;
  typeHint: string | null;
  lastFour: string | null;
  coaCode: string;
  coaLabel: string;
  status: TransactionStatus;
}

export interface TransactionMonth {
  /** Months that have transactions, newest first ("2025-02"). */
  months: string[];
  /** The month shown: the one asked for, or the newest. Null when there is nothing yet. */
  month: string | null;
  transactions: TransactionView[];
  totals: { count: number; moneyIn: string; moneyOut: string };
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(BankTransaction)
    private readonly transactions: Repository<BankTransaction>,
    @InjectRepository(TransactionUpload)
    private readonly uploads: Repository<TransactionUpload>,
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    private readonly coa: CoaService,
  ) {}

  /** One month of a pharmacy's transactions, optionally for one account. */
  async month(
    pharmacyId: number,
    filter: { month?: string; accountId?: number },
  ): Promise<TransactionMonth> {
    if (!(await this.pharmacies.existsBy({ id: pharmacyId }))) {
      throw new NotFoundException('Pharmacy not found.');
    }
    const uploads = await this.uploads.find({
      where: filter.accountId
        ? { pharmacyId, accountId: filter.accountId }
        : { pharmacyId },
    });
    const months = [
      ...new Set(uploads.flatMap((u) => u.months.split(',').filter(Boolean))),
    ].sort((a, b) => b.localeCompare(a));
    const month = filter.month ?? months[0] ?? null;
    if (!month) {
      return { months, month, transactions: [], totals: totals([]) };
    }

    const rows = await this.transactions.find({
      where: filter.accountId
        ? { pharmacyId, period: month, accountId: filter.accountId }
        : { pharmacyId, period: month },
    });
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const labels = new Map(
      (await this.coa.list()).map((a) => [a.code, a.label]),
    );
    return {
      months,
      month,
      totals: totals(rows),
      transactions: rows.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        uploadId: t.uploadId,
        date: t.date,
        postDate: t.postDate,
        description: t.description,
        memo: t.memo,
        amount: t.amount,
        typeHint: t.typeHint,
        lastFour: t.lastFour,
        coaCode: t.coaCode,
        coaLabel: labels.get(t.coaCode) ?? t.coaCode,
        status: t.status,
      })),
    };
  }
}

function totals(rows: BankTransaction[]) {
  const cents = rows.map((r) => parseCents(r.amount) ?? 0);
  return {
    count: rows.length,
    moneyIn: centsToDecimal(
      cents.filter((c) => c > 0).reduce((a, b) => a + b, 0),
    ),
    moneyOut: centsToDecimal(
      cents.filter((c) => c < 0).reduce((a, b) => a + b, 0),
    ),
  };
}
