import { Controller, Get, Param, Query, ValidationPipe } from '@nestjs/common';
import { CasesService } from '../services/cases.service';
import { CaseQueryDto } from '../dto/case-query.dto';
import {
  PaginatedCasesResponseDto,
  CaseResponseDto,
} from '../dto/case-response.dto';

@Controller('api/cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  async findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    queryDto: CaseQueryDto,
  ): Promise<PaginatedCasesResponseDto> {
    return this.casesService.findAll(queryDto);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<CaseResponseDto> {
    return this.casesService.findById(id);
  }

  @Get('mfkn/:mfknId')
  async findByMfknId(
    @Param('mfknId') mfknId: string,
  ): Promise<CaseResponseDto> {
    return this.casesService.findByMfknId(mfknId);
  }
}
