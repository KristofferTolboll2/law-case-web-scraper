import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../../database/entities/case.entity';
import { StatisticsResponseDto } from '../dto/statistics-response.dto';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Case)
    private caseRepository: Repository<Case>,
  ) {}

  async getStatistics(): Promise<StatisticsResponseDto> {
    // Get basic counts
    const totalCases = await this.caseRepository.count();
    const enrichedCases = await this.caseRepository
      .createQueryBuilder('case')
      .innerJoin('case.content', 'content')
      .getCount();

    const pendingCases = totalCases - enrichedCases;

    // Get date statistics
    const dateStats = await this.caseRepository
      .createQueryBuilder('case')
      .select([
        'MIN(case.decisionDate) as "oldestCaseDate"',
        'MAX(case.decisionDate) as "latestCaseDate"',
      ])
      .where('case.decisionDate IS NOT NULL')
      .getRawOne();

    // Get recent additions
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const casesAddedToday = await this.caseRepository
      .createQueryBuilder('case')
      .where('case.createdAt >= :todayStart', { todayStart })
      .getCount();

    const casesAddedThisWeek = await this.caseRepository
      .createQueryBuilder('case')
      .where('case.createdAt >= :weekStart', { weekStart })
      .getCount();

    const casesAddedThisMonth = await this.caseRepository
      .createQueryBuilder('case')
      .where('case.createdAt >= :monthStart', { monthStart })
      .getCount();

    return {
      totalCases,
      enrichedCases,
      pendingCases,
      latestCaseDate: dateStats?.latestCaseDate,
      oldestCaseDate: dateStats?.oldestCaseDate,
      casesAddedToday,
      casesAddedThisWeek,
      casesAddedThisMonth,
    };
  }
}
