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
import { PharmaciesService } from './pharmacies.service.js';
import type { Pharmacy } from './pharmacy.entity.js';
import { PharmacyInput } from './pharmacy.input.js';

/** Admin-only: manage client pharmacies. */
@Roles('admin')
@Controller('pharmacies')
export class PharmaciesController {
  constructor(private readonly pharmacies: PharmaciesService) {}

  /** GET /api/pharmacies — all pharmacies, by name. */
  @Get()
  list(): Promise<Pharmacy[]> {
    return this.pharmacies.list();
  }

  /** GET /api/pharmacies/:id */
  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): Promise<Pharmacy> {
    return this.pharmacies.get(id);
  }

  /** POST /api/pharmacies — add a pharmacy. */
  @Post()
  create(@Body() body: PharmacyInput): Promise<Pharmacy> {
    return this.pharmacies.create(body);
  }

  /** PUT /api/pharmacies/:id — replace a pharmacy's details. */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PharmacyInput,
  ): Promise<Pharmacy> {
    return this.pharmacies.update(id, body);
  }
}
