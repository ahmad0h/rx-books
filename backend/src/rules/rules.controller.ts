import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import type { RuleView } from './rule.entity.js';
import {
  CreateRuleInput,
  TestRulesInput,
  UpdateRuleInput,
} from './rule.input.js';
import { RulesService, type RuleTestResult } from './rules.service.js';

/** ?pharmacy=shared or ?pharmacy=12 */
function listFrom(value: string | undefined): number | null {
  if (value === undefined || value === 'shared') return null;
  if (/^\d+$/.test(value)) return Number(value);
  throw new BadRequestException('Use ?pharmacy=shared or a pharmacy id.');
}

/** Categorization rules. Admin only for now. */
@Roles('admin')
@Controller('rules')
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  /** GET /api/rules?pharmacy=shared|:id — one list, retired rules included. */
  @Get()
  list(@Query('pharmacy') pharmacy?: string): Promise<RuleView[]> {
    return this.rules.list(listFrom(pharmacy));
  }

  /** POST /api/rules — add a rule (pharmacyId null = shared). */
  @Post()
  create(@Body() body: CreateRuleInput): Promise<RuleView> {
    return this.rules.create(body);
  }

  /** POST /api/rules/test — which rule would categorize this description? */
  @Post('test')
  @HttpCode(200)
  test(@Body() body: TestRulesInput): Promise<RuleTestResult> {
    return this.rules.test(body.description, body.pharmacyId ?? null);
  }

  /** PUT /api/rules/:id */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRuleInput,
  ): Promise<RuleView> {
    return this.rules.update(id, body);
  }

  /** DELETE /api/rules/:id — retires the rule; nothing is erased. */
  @Delete(':id')
  retire(@Param('id', ParseIntPipe) id: number): Promise<RuleView> {
    return this.rules.retire(id);
  }

  /** POST /api/rules/:id/restore — bring a retired rule back. */
  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id', ParseIntPipe) id: number): Promise<RuleView> {
    return this.rules.restore(id);
  }
}
