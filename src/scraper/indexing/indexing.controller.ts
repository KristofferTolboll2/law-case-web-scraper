import { Controller, Post, Get, Body } from '@nestjs/common';
import { IndexingService } from './indexing.service';

@Controller('indexing')
export class IndexingController {
  constructor(private indexingService: IndexingService) {}

  @Post('start')
  async startIndexing(@Body() body: { batches?: number; caseLimit?: number }) {
    const { batches, caseLimit } = body;
    return this.indexingService.indexCases(batches, caseLimit);
  }

  @Get('stats')
  async getStats() {
    return this.indexingService.getCaseStats();
  }

  @Get('status')
  async getIndexingStatus() {
    return this.indexingService.getIndexingStatus();
  }

  @Post('reset')
  async resetIndexing() {
    return this.indexingService.resetIndexingFlag();
  }
}
