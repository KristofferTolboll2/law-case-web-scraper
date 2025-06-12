import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case } from '../database/entities/case.entity';
import { CasesController } from './controllers/cases.controller';
import { StatisticsController } from './controllers/statistics.controller';
import { CasesResolver } from './resolvers/cases.resolver';
import { CasesService } from './services/cases.service';
import { StatisticsService } from './services/statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Case])],
  controllers: [CasesController, StatisticsController],
  providers: [CasesService, StatisticsService, CasesResolver],
  exports: [CasesService, StatisticsService],
})
export class ApiModule {}
