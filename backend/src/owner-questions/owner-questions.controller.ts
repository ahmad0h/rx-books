import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { SessionUser } from '../auth/session-user.js';
import { AnswerInput, AskOwnerInput } from './owner-question.input.js';
import {
  OwnerQuestionsService,
  type AskResult,
  type OwnerCategory,
  type OwnerQuestionCard,
} from './owner-questions.service.js';

/** Staff: ask the owner, cancel a question, accept an answer. */
@Roles('admin')
@Controller('pharmacies/:pharmacyId/questions')
export class StaffQuestionsController {
  constructor(private readonly questions: OwnerQuestionsService) {}

  /** POST /api/pharmacies/:pharmacyId/questions — ask about transactions. */
  @Post()
  ask(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Body() body: AskOwnerInput,
    @CurrentUser() user: SessionUser,
  ): Promise<AskResult> {
    return this.questions.ask(pharmacyId, body.items, user.id);
  }

  /** POST /api/pharmacies/:pharmacyId/questions/:id/cancel */
  @Post(':id/cancel')
  @HttpCode(204)
  cancel(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.questions.cancel(pharmacyId, id, user.id);
  }

  /** POST /api/pharmacies/:pharmacyId/questions/:id/accept — use the owner's answer. */
  @Post(':id/accept')
  @HttpCode(204)
  accept(
    @Param('pharmacyId', ParseIntPipe) pharmacyId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.questions.accept(pharmacyId, id, user.id);
  }
}

/** Pharmacy owners: their own questions only. */
@Roles('client')
@Controller('client')
export class OwnerQuestionsController {
  constructor(private readonly questions: OwnerQuestionsService) {}

  /** GET /api/client/questions — open questions for the owner's pharmacy. */
  @Get('questions')
  list(
    @CurrentUser() user: SessionUser,
  ): Promise<{ pharmacyName: string; questions: OwnerQuestionCard[] }> {
    return this.questions.ownerQuestions(user.id);
  }

  /** GET /api/client/categories — plain-language categories to choose from. */
  @Get('categories')
  categories(): Promise<OwnerCategory[]> {
    return this.questions.ownerCategories();
  }

  /** PUT /api/client/questions/:id — answer (or change the answer). */
  @Put('questions/:id')
  @HttpCode(204)
  answer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AnswerInput,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.questions.answer(user.id, id, body);
  }
}
