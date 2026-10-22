import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { SessionUser } from '../auth/session-user.js';
import { TransactionsQuery, UploadFileInput } from './transaction.input.js';
import {
  TransactionsService,
  type TransactionMonth,
} from './transactions.service.js';
import {
  UploadsService,
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

  /** POST /api/pharmacies/:pharmacyId/uploads — import the file's new rows. */
  @Post('uploads')
  import(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Body() body: UploadFileInput,
    @CurrentUser() user: SessionUser,
  ): Promise<UploadView> {
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
}
