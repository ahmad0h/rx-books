import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type Repository } from 'typeorm';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { UsersService } from '../users/users.service.js';
import { BankTransaction } from './bank-transaction.entity.js';
import { readBankFile, type BankFormat } from './bank-formats.js';
import {
  fileFingerprint,
  fingerprint,
  type FingerprintedRow,
} from './fingerprint.js';
import { centsToDecimal } from './money.js';
import { TransactionUpload } from './transaction-upload.entity.js';
import type { UploadFileInput } from './transaction.input.js';

/** New = will be added; loaded = already stored; held = needs a person (PRD 10.1). */
export type RowStatus = 'new' | 'loaded' | 'held';

export interface PreviewRow {
  line: number;
  date: string;
  description: string;
  memo: string | null;
  amount: string;
  lastFour: string | null;
  status: RowStatus;
}

export interface UploadPreview {
  fileName: string;
  format: { id: string; label: string };
  account: { id: number; name: string; lastFour: string };
  summary: {
    rows: number;
    new: number;
    loaded: number;
    held: number;
    firstDate: string;
    lastDate: string;
    months: string[];
    /** Totals for every row in the file. */
    moneyIn: string;
    moneyOut: string;
  };
  warnings: string[];
  rows: PreviewRow[];
}

export interface UploadView {
  id: number;
  accountId: number;
  fileName: string;
  format: string;
  uploadedBy: string;
  rowsInFile: number;
  rowsAdded: number;
  rowsSkipped: number;
  rowsHeld: number;
  firstDate: string;
  lastDate: string;
  months: string[];
  createdAt: Date;
}

interface Analysis {
  preview: UploadPreview;
  format: BankFormat;
  rows: (FingerprintedRow & { status: RowStatus })[];
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

@Injectable()
export class UploadsService {
  constructor(
    @InjectRepository(TransactionUpload)
    private readonly uploads: Repository<TransactionUpload>,
    @InjectRepository(BankTransaction)
    private readonly transactions: Repository<BankTransaction>,
    @InjectRepository(PharmacyAccount)
    private readonly accounts: Repository<PharmacyAccount>,
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  /** Reads and checks the file. Nothing is saved. */
  async preview(
    pharmacyId: number,
    input: UploadFileInput,
  ): Promise<UploadPreview> {
    return (await this.analyze(pharmacyId, input)).preview;
  }

  /** Saves the new rows, all in 9999 · Uncategorized, with a record of the upload. */
  async import(
    pharmacyId: number,
    input: UploadFileInput,
    userId: number,
  ): Promise<UploadView> {
    const { preview, format, rows } = await this.analyze(pharmacyId, input);
    const added = rows.filter((r) => r.status === 'new');
    if (added.length === 0) {
      throw new BadRequestException(
        preview.summary.held > 0
          ? 'Nothing to import: every row is already loaded or held for review.'
          : 'Nothing to import: every row in this file is already loaded.',
      );
    }

    try {
      const upload = await this.dataSource.transaction(async (manager) => {
        const uploads = manager.getRepository(TransactionUpload);
        const transactions = manager.getRepository(BankTransaction);
        const saved = await uploads.save(
          uploads.create({
            pharmacyId,
            accountId: input.accountId,
            fileName: input.fileName,
            fileSha256: fileFingerprint(input.content),
            format: format.id,
            uploadedBy: userId,
            rowsInFile: preview.summary.rows,
            rowsAdded: added.length,
            rowsSkipped: preview.summary.loaded,
            rowsHeld: preview.summary.held,
            firstDate: preview.summary.firstDate,
            lastDate: preview.summary.lastDate,
            months: preview.summary.months.join(','),
          }),
        );
        await transactions.save(
          added.map((row) =>
            transactions.create({
              pharmacyId,
              accountId: input.accountId,
              uploadId: saved.id,
              period: row.date.slice(0, 7),
              date: row.date,
              postDate: row.postDate,
              description: row.description,
              memo: row.memo,
              amount: centsToDecimal(row.cents),
              typeHint: row.typeHint,
              lastFour: row.lastFour,
              signature: row.signature,
              sourceRowId: row.sourceRowId,
              occurrence: row.occurrence,
              coaCode: '9999',
              status: 'uncategorized',
            }),
          ),
          { chunk: 500 },
        );
        return saved;
      });
      return (await this.views([upload]))[0];
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictException(
          'Some of these rows were just imported by someone else. Preview the file again.',
        );
      }
      throw error;
    }
  }

  /** Upload history, newest first. */
  async list(pharmacyId: number): Promise<UploadView[]> {
    await this.requirePharmacy(pharmacyId);
    const rows = await this.uploads.find({ where: { pharmacyId } });
    rows.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
    );
    return this.views(rows);
  }

  private async analyze(
    pharmacyId: number,
    input: UploadFileInput,
  ): Promise<Analysis> {
    await this.requirePharmacy(pharmacyId);
    const account = await this.accounts.findOneBy({
      id: input.accountId,
      pharmacyId,
    });
    if (!account) throw new NotFoundException('Account not found.');
    if (account.closedOn) {
      throw new BadRequestException(
        `${account.name} was closed on ${account.closedOn}. Reopen it to upload transactions.`,
      );
    }

    const read = readBankFile(input.content);
    if (!read.ok) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: read.errors,
      });
    }
    const { format } = read;
    if (!format.kinds.includes(account.kind)) {
      throw new BadRequestException(
        `This is a ${format.label} file, but ${account.name} is a ${account.kind.replace('_', ' ')} account. Choose the right account.`,
      );
    }

    // PRD 10.1: compare each group of identical rows with what is already stored.
    const rows = fingerprint(pharmacyId, account.id, read.rows);
    const inFile = countBy(rows.map((r) => r.signature));
    const stored = countBy(
      (
        await this.transactions.find({
          where: { accountId: account.id, signature: In([...inFile.keys()]) },
        })
      ).map((t) => t.signature),
    );
    const statusOf = (signature: string): RowStatus => {
      const have = stored.get(signature) ?? 0;
      if (have === 0) return 'new';
      return have === inFile.get(signature) ? 'loaded' : 'held';
    };
    const analyzed = rows.map((row) => ({
      ...row,
      status: statusOf(row.signature),
    }));

    const dates = analyzed.map((r) => r.date).sort();
    const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
    const count = (status: RowStatus) =>
      analyzed.filter((r) => r.status === status).length;
    const sum = (positive: boolean) =>
      centsToDecimal(
        analyzed
          .filter((r) => (positive ? r.cents > 0 : r.cents < 0))
          .reduce((total, r) => total + r.cents, 0),
      );

    const warnings: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const early = account.openedOn
      ? analyzed.filter((r) => r.date < account.openedOn!).length
      : 0;
    if (early > 0) {
      warnings.push(
        `${plural(early, 'row is', 'rows are')} dated before the account was opened (${account.openedOn}). Check you chose the right account.`,
      );
    }
    const future = analyzed.filter((r) => r.date > today).length;
    if (future > 0) {
      warnings.push(
        `${plural(future, 'row is', 'rows are')} dated in the future.`,
      );
    }
    const held = count('held');
    if (held > 0) {
      warnings.push(
        `${plural(held, 'row is', 'rows are')} held back: the file has a different number of identical rows than already stored. These need a person to decide and are not imported.`,
      );
    }
    if (count('new') === 0 && held === 0) {
      warnings.push(
        'Everything in this file is already loaded. There is nothing new to import.',
      );
    }

    return {
      format,
      rows: analyzed,
      preview: {
        fileName: input.fileName,
        format: { id: format.id, label: format.label },
        account: {
          id: account.id,
          name: account.name,
          lastFour: account.lastFour,
        },
        summary: {
          rows: analyzed.length,
          new: count('new'),
          loaded: count('loaded'),
          held,
          firstDate: dates[0],
          lastDate: dates[dates.length - 1],
          months,
          moneyIn: sum(true),
          moneyOut: sum(false),
        },
        warnings,
        rows: analyzed.map((r) => ({
          line: r.line,
          date: r.date,
          description: r.description,
          memo: r.memo,
          amount: centsToDecimal(r.cents),
          lastFour: r.lastFour,
          status: r.status,
        })),
      },
    };
  }

  private async requirePharmacy(id: number) {
    if (!(await this.pharmacies.existsBy({ id }))) {
      throw new NotFoundException('Pharmacy not found.');
    }
  }

  private async views(uploads: TransactionUpload[]): Promise<UploadView[]> {
    const names = new Map<number, string>();
    for (const id of new Set(uploads.map((u) => u.uploadedBy))) {
      names.set(id, (await this.users.findById(id))?.name ?? 'Unknown user');
    }
    return uploads.map((u) => ({
      id: u.id,
      accountId: u.accountId,
      fileName: u.fileName,
      format: u.format,
      uploadedBy: names.get(u.uploadedBy) ?? 'Unknown user',
      rowsInFile: u.rowsInFile,
      rowsAdded: u.rowsAdded,
      rowsSkipped: u.rowsSkipped,
      rowsHeld: u.rowsHeld,
      firstDate: u.firstDate,
      lastDate: u.lastDate,
      months: u.months.split(',').filter(Boolean),
      createdAt: u.createdAt,
    }));
  }
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}
