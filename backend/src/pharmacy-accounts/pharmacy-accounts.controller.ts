import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import type { PharmacyAccountView } from './pharmacy-account.entity.js';
import { PharmacyAccountInput } from './pharmacy-account.input.js';
import { PharmacyAccountsService } from './pharmacy-accounts.service.js';

/** Admin-only: a pharmacy's own bank and card accounts. */
@Roles('admin')
@Controller('pharmacies/:pharmacyId/accounts')
export class PharmacyAccountsController {
  constructor(private readonly accounts: PharmacyAccountsService) {}

  /** GET /api/pharmacies/:pharmacyId/accounts */
  @Get()
  list(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
  ): Promise<PharmacyAccountView[]> {
    return this.accounts.list(pharmacyId);
  }

  /** POST /api/pharmacies/:pharmacyId/accounts */
  @Post()
  create(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Body() body: PharmacyAccountInput,
  ): Promise<PharmacyAccountView> {
    return this.accounts.create(pharmacyId, body);
  }

  /** PUT /api/pharmacies/:pharmacyId/accounts/:id — edit, close (closedOn) or reopen. */
  @Put(':id')
  update(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PharmacyAccountInput,
  ): Promise<PharmacyAccountView> {
    return this.accounts.update(pharmacyId, id, body);
  }
}
