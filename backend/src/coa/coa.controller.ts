import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import type { CoaAccountView } from './coa-account.entity.js';
import { CreateCoaInput, UpdateCoaInput } from './coa.input.js';
import { CoaService } from './coa.service.js';

/** The chart of accounts. Anyone signed in can read it; only admins change it. */
@Controller('coa')
export class CoaController {
  constructor(private readonly coa: CoaService) {}

  /** GET /api/coa — every account, by code. */
  @Get()
  list(): Promise<CoaAccountView[]> {
    return this.coa.list();
  }

  /** GET /api/coa/:code */
  @Get(':code')
  get(@Param('code') code: string): Promise<CoaAccountView> {
    return this.coa.get(code);
  }

  /** POST /api/coa — add an account. */
  @Roles('admin')
  @Post()
  create(@Body() body: CreateCoaInput): Promise<CoaAccountView> {
    return this.coa.create(body);
  }

  /** PUT /api/coa/:code — edit an account (the code itself never changes). */
  @Roles('admin')
  @Put(':code')
  update(
    @Param('code') code: string,
    @Body() body: UpdateCoaInput,
  ): Promise<CoaAccountView> {
    return this.coa.update(code, body);
  }
}
