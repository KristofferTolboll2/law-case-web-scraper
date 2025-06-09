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
    // Get ALL statistics in a single optimized query!
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = await this.caseRepository
      .createQueryBuilder('case')
      .leftJoin('case.content', 'content')
      .select([
        'COUNT(case.id) as "totalCases"',
        'COUNT(content.id) as "enrichedCases"',
        'MIN(case.decisionDate) as "oldestCaseDate"',
        'MAX(case.decisionDate) as "latestCaseDate"',
        `SUM(CASE WHEN case.createdAt >= '${todayStart.toISOString()}' THEN 1 ELSE 0 END) as "casesAddedToday"`,
        `SUM(CASE WHEN case.createdAt >= '${weekStart.toISOString()}' THEN 1 ELSE 0 END) as "casesAddedThisWeek"`,
        `SUM(CASE WHEN case.createdAt >= '${monthStart.toISOString()}' THEN 1 ELSE 0 END) as "casesAddedThisMonth"`,
      ])
      .where('case.decisionDate IS NOT NULL OR case.decisionDate IS NULL')
      .getRawOne();

    const totalCases = parseInt(stats.totalCases) || 0;
    const enrichedCases = parseInt(stats.enrichedCases) || 0;
    const pendingCases = totalCases - enrichedCases;

    return {
      totalCases,
      enrichedCases,
      pendingCases,
      latestCaseDate: stats.latestCaseDate,
      oldestCaseDate: stats.oldestCaseDate,
      casesAddedToday: parseInt(stats.casesAddedToday) || 0,
      casesAddedThisWeek: parseInt(stats.casesAddedThisWeek) || 0,
      casesAddedThisMonth: parseInt(stats.casesAddedThisMonth) || 0,
    };
  }
}
