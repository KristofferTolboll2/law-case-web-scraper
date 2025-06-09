import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Case } from '../../database/entities/case.entity';
import { CaseQueryDto } from '../dto/case-query.dto';
import {
  PaginatedCasesResponseDto,
  PaginationMetaDto,
  CaseResponseDto,
} from '../dto/case-response.dto';

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(Case)
    private caseRepository: Repository<Case>,
  ) {}

  async findAll(queryDto: CaseQueryDto): Promise<PaginatedCasesResponseDto> {
    const {
      page = 1,
      limit = 20,
      search,
      caseNumber,
      fromDate,
      toDate,
      sortBy = 'decisionDate',
      sortOrder = 'desc',
    } = queryDto;

    const queryBuilder = this.caseRepository
      .createQueryBuilder('case')
      .leftJoinAndSelect('case.content', 'content');

    this.applyFilters(queryBuilder, { search, caseNumber, fromDate, toDate });

    const sortField =
      sortBy === 'decisionDate'
        ? 'case.decisionDate'
        : sortBy === 'createdAt'
          ? 'case.createdAt'
          : 'case.title';

    queryBuilder.orderBy(sortField, sortOrder.toUpperCase() as 'ASC' | 'DESC');

    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [cases, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMetaDto = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    // Transform to DTOs
    const data: CaseResponseDto[] = cases.map(this.transformToDto);

    return { data, meta };
  }

  async findById(id: string): Promise<CaseResponseDto> {
    const caseEntity = await this.caseRepository.findOne({
      where: { id },
      relations: ['content'],
    });

    if (!caseEntity) {
      throw new NotFoundException(`Case with ID ${id} not found`);
    }

    return this.transformToDto(caseEntity);
  }

  async findByMfknId(mfknId: string): Promise<CaseResponseDto> {
    const caseEntity = await this.caseRepository.findOne({
      where: { mfknId },
      relations: ['content'],
    });

    if (!caseEntity) {
      throw new NotFoundException(`Case with MFKN ID ${mfknId} not found`);
    }

    return this.transformToDto(caseEntity);
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Case>,
    filters: {
      search?: string;
      caseNumber?: string;
      fromDate?: string;
      toDate?: string;
    },
  ): void {
    const { search, caseNumber, fromDate, toDate } = filters;

    if (search) {
      queryBuilder.andWhere(
        '(case.title ILIKE :search OR case.caseNumber ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (caseNumber) {
      queryBuilder.andWhere('case.caseNumber ILIKE :caseNumber', {
        caseNumber: `%${caseNumber}%`,
      });
    }

    if (fromDate) {
      queryBuilder.andWhere('case.decisionDate >= :fromDate', { fromDate });
    }

    if (toDate) {
      queryBuilder.andWhere('case.decisionDate <= :toDate', { toDate });
    }
  }

  private transformToDto(caseEntity: Case): CaseResponseDto {
    const dto: CaseResponseDto = {
      id: caseEntity.id,
      mfknId: caseEntity.mfknId,
      title: caseEntity.title,
      caseNumber: caseEntity.caseNumber,
      decisionDate: caseEntity.decisionDate,
      sourceUrl: caseEntity.sourceUrl,
      createdAt: caseEntity.createdAt,
      updatedAt: caseEntity.updatedAt,
    };

    // Include content if it exists
    if (caseEntity.content) {
      dto.content = {
        paragraphs: caseEntity.content.paragraphs,
        links: caseEntity.content.links,
        court: caseEntity.content.court,
        parties: caseEntity.content.parties,
        keywords: caseEntity.content.keywords,
        fullText: caseEntity.content.fullText,
        createdAt: caseEntity.content.createdAt,
        updatedAt: caseEntity.content.updatedAt,
      };
    }

    return dto;
  }
}
