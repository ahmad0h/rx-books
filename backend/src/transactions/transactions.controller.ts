import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { SessionUser } from '../auth/session-user.js';
import type { CategorizeResult } from './categorization.service.js';
import {
  CategorizeInput,
  SetAccountInput,
  TransactionIdsInput,
  TransactionsQuery,
  UploadFileInput,
} from './transaction.input.js';
import {
  TransactionsService,
  type TransactionMonth,
  type TransactionView,
} from './transactions.service.js';
import {
  UploadsService,
  type ImportResult,
  type UploadPreview,
  type UploadView,
} from './uploads.service.js';

/** Admin-only: upload a pharmacy's bank CSVs and list its transactions. */
@Roles('admin')
@Controller('pharmacies/:pharmacyId')
export class TransactionsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly transactions: TransactionsService,
  ) {}

  /** POST /api/pharmacies/:pharmacyId/uploads/preview — read and check a file; nothing is saved. */
  @Post('uploads/preview')
  @HttpCode(200)
  preview(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Body() body: UploadFileInput,
  ): Promise<UploadPreview> {
    return this.uploads.preview(pharmacyId, body);
  }

  /** POST /api/pharmacies/:pharmacyId/uploads — import the file's new rows, then run the rules. */
  @Post('uploads')
  import(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Body() body: UploadFileInput,
    @CurrentUser() user: SessionUser,
  ): Promise<ImportResult> {
    return this.uploads.import(pharmacyId, body, user.id);
  }

  /** GET /api/pharmacies/:pharmacyId/uploads — upload history, newest first. */
  @Get('uploads')
  listUploads(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
  ): Promise<UploadView[]> {
    return this.uploads.list(pharmacyId);
  }

  /** GET /api/pharmacies/:pharmacyId/transactions?month=2025-01&accountId=3 */
  @Get('transactions')
  listTransactions(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Query() query: TransactionsQuery,
  ): Promise<TransactionMonth> {
    return this.transactions.month(pharmacyId, query);
  }

  /** PUT /api/pharmacies/:pharmacyId/transactions/:id — a person chooses the account. */
  @Put('transactions/:id')
  setAccount(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetAccountInput,
    @CurrentUser() user: SessionUser,
  ): Promise<TransactionView> {
    return this.transactions.setAccount(pharmacyId, id, body.coaCode, user.id);
  }

  /** POST /api/pharmacies/:pharmacyId/transactions/approve — approve suggested rows. */
  @Post('transactions/approve')
  @HttpCode(200)
  approve(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Body() body: TransactionIdsInput,
    @CurrentUser() user: SessionUser,
  ): Promise<{ approved: number; skipped: number }> {
    return this.transactions.approve(pharmacyId, body.ids, user.id);
  }

  /** POST /api/pharmacies/:pharmacyId/transactions/unapprove — back to "suggested". */
  @Post('transactions/unapprove')
  @HttpCode(200)
  unapprove(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Body() body: TransactionIdsInput,
  ): Promise<{ unapproved: number }> {
    return this.transactions.unapprove(pharmacyId, body.ids);
  }

  /** POST /api/pharmacies/:pharmacyId/transactions/categorize — run the rules again on a month. */
  @Post('transactions/categorize')
  @HttpCode(200)
  categorize(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Body() body: CategorizeInput,
  ): Promise<CategorizeResult> {
    return this.transactions.categorize(pharmacyId, body);
  }
}
