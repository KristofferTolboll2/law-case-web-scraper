import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case } from '../database/entities/case.entity';
import { CaseContent } from '../database/entities/case-content.entity';
import { IndexingService } from './indexing/indexing.service';
import { IndexingController } from './indexing/indexing.controller';
import { HttpClientService } from './shared/http-client.service';
import { ParserService } from './shared/parser.service';
import { CaseContentParserService } from './shared/case-content-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([Case, CaseContent])],
  controllers: [IndexingController],
  providers: [
    IndexingService,
    HttpClientService,
    ParserService,
    CaseContentParserService,
  ],
  exports: [IndexingService],
})
export class ScraperModule {}
