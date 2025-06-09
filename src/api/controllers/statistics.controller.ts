import { Controller, Get } from '@nestjs/common';
import { StatisticsService } from '../services/statistics.service';
import { StatisticsResponseDto } from '../dto/statistics-response.dto';

@Controller('api/statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  async getStatistics(): Promise<StatisticsResponseDto> {
    return this.statisticsService.getStatistics();
  }
}
