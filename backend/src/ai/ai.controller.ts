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
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { SessionUser } from '../auth/session-user.js';
import { AiRunsQuery, AskAiInput, SavePromptInput } from './ai.input.js';
import {
  AiService,
  type AiRunView,
  type AiStatus,
  type AskAiResult,
  type PromptView,
} from './ai.service.js';

/** Admin-only: AI suggestions, the AI instructions, and the AI run log. */
@Roles('admin')
@Controller()
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** GET /api/ai/status — is AI set up, which model, which instructions version. */
  @Get('ai/status')
  status(): Promise<AiStatus> {
    return this.ai.status();
  }

  /** GET /api/ai/prompts — every version of the instructions, newest first. */
  @Get('ai/prompts')
  prompts(): Promise<PromptView[]> {
    return this.ai.listPrompts();
  }

  /** POST /api/ai/prompts — save the instructions as a new version. */
  @Post('ai/prompts')
  savePrompt(
    @Body() body: SavePromptInput,
    @CurrentUser() user: SessionUser,
  ): Promise<PromptView> {
    return this.ai.savePrompt(body.body, user.id);
  }

  /** GET /api/ai/runs?pharmacyId=1 — the AI run log, newest first. */
  @Get('ai/runs')
  runs(@Query() query: AiRunsQuery): Promise<AiRunView[]> {
    return this.ai.listRuns(query.pharmacyId);
  }

  /** POST /api/pharmacies/:pharmacyId/transactions/ai — ask AI about the chosen rows. */
  @Post('pharmacies/:pharmacyId/transactions/ai')
  @HttpCode(200)
  // Each call can cost money; a slip of the finger shouldn't repeat it many times.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  suggest(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Body() body: AskAiInput,
    @CurrentUser() user: SessionUser,
  ): Promise<AskAiResult> {
    return this.ai.suggest(pharmacyId, body.ids, user.id);
  }
}
