import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Case } from '../../database/entities/case.entity';
import { CaseContent } from '../../database/entities/case-content.entity';
import { HttpClientService } from '../shared/http-client.service';
import { ParserService } from '../shared/parser.service';
import { CaseContentParserService } from '../shared/case-content-parser.service';

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);
  private readonly baseUrl: string;
  private readonly searchUrl: string;
  private isIndexing = false;

  constructor(
    @InjectRepository(Case)
    private caseRepository: Repository<Case>,
    @InjectRepository(CaseContent)
    private caseContentRepository: Repository<CaseContent>,
    private httpClient: HttpClientService,
    private parser: ParserService,
    private caseContentParser: CaseContentParserService,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get(
      'MFKN_BASE_URL',
      'https://mfkn.naevneneshus.dk',
    );
    this.searchUrl = this.configService.get(
      'MFKN_SEARCH_URL',
      'https://mfkn.naevneneshus.dk/soeg',
    );
  }

  async indexCases(
    batches?: number,
    caseLimit?: number,
  ): Promise<{ indexed: number; skipped: number }> {
    if (this.isIndexing) {
      throw new HttpException(
        'Indexing process is already running',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.isIndexing = true;
    try {
      this.logger.log('Starting cursor-based case indexing...');

      let totalIndexed = 0;
      let totalSkipped = 0;
      const CASES_PER_BATCH = 10; // Each infinite scroll batch contains ~10 cases
      const MAX_BATCHES = 20; // Maximum number of batches to fetch as safety limit

      const maxBatches = batches ? Math.min(batches, MAX_BATCHES) : MAX_BATCHES;

      this.logger.log(
        `Requested ${batches || 'all'} batches, fetching ${maxBatches} batches (~${maxBatches * CASES_PER_BATCH} cases max)`,
      );

      const searchUrl = this.buildSearchUrl();

      const htmlBatches =
        await this.httpClient.fetchSearchPageWithInfiniteScroll(
          searchUrl,
          maxBatches,
        );

      if (htmlBatches.length === 0) {
        this.logger.log('No content batches retrieved');
        return { indexed: 0, skipped: 0 };
      }

      const finalBatch = htmlBatches[htmlBatches.length - 1];
      const allCases = this.parser.parseSearchResults(finalBatch);

      if (allCases.length === 0) {
        this.logger.log('No cases found in final batch');
        return { indexed: 0, skipped: 0 };
      }

      this.logger.log(
        `Found ${allCases.length} total cases across ${htmlBatches.length} scroll batches`,
      );

      const casesToProcess = caseLimit
        ? allCases.slice(0, caseLimit)
        : allCases;

      this.logger.log(
        `Processing ${casesToProcess.length} cases with batch UPSERT (no duplicate checking needed)`,
      );

      const batchResult = await this.processBatchWithUpsert(casesToProcess);
      totalIndexed = batchResult.indexed;
      totalSkipped = batchResult.skipped;

      this.logger.log(
        `Indexing completed. Total: ${totalIndexed} indexed, ${totalSkipped} skipped`,
      );

      return { indexed: totalIndexed, skipped: totalSkipped };
    } finally {
      this.isIndexing = false;
    }
  }

  private async processBatchWithUpsert(
    cases: any[],
  ): Promise<{ indexed: number; skipped: number }> {
    this.logger.log(
      `Processing ${cases.length} cases in FULL PARALLEL with simple UPSERT...`,
    );

    const startTime = Date.now();
    const allResults = await Promise.allSettled(
      cases.map(async (caseItem, index) => {
        try {
          const casePageHtml = await this.httpClient.fetchCasePage(
            caseItem.url,
          );
          const caseContent = this.caseContentParser.parseContent(casePageHtml);

          await this.dataSource.transaction(async (manager) => {
            const newCase = manager.create(Case, {
              mfknId: caseItem.id,
              title: caseItem.title,
              caseNumber: caseItem.caseNumber || null,
              decisionDate: caseItem.decisionDate,
              sourceUrl: caseItem.url,
            });

            const savedCase = await manager.save(newCase);

            await manager.save(CaseContent, {
              caseId: savedCase.id,
              paragraphs: caseContent.paragraphs,
              links: caseContent.links,
              court: caseContent.court,
              parties: caseContent.parties,
              keywords: caseContent.keywords,
              fullText: caseContent.fullText,
            });
          });

          return { success: true, caseId: caseItem.id };
        } catch (error) {
          if (
            error.code === '23505' ||
            error.message.includes('duplicate key')
          ) {
            return { success: false, skipped: true, caseId: caseItem.id };
          }

          this.logger.error(
            ` [${index + 1}/${cases.length}] Error processing case ${caseItem.id}: ${error.message}`,
          );
          return {
            success: false,
            skipped: false,
            caseId: caseItem.id,
            error: error.message,
          };
        }
      }),
    );

    const processingTime = Date.now() - startTime;

    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          indexed++;
        } else if (result.value.skipped) {
          skipped++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    }

    this.logger.log(
      ` Processing complete in ${processingTime}ms: ${indexed} inserted, ${skipped} skipped, ${failed} failed`,
    );

    return { indexed, skipped: skipped + failed };
  }

  private buildSearchUrl(): string {
    const params = new URLSearchParams({
      sort: 'desc',
      types: 'ruling',
    });

    return `${this.searchUrl}?${params.toString()}`;
  }

  async getIndexingStatus(): Promise<{ isIndexing: boolean }> {
    return { isIndexing: this.isIndexing };
  }

  async resetIndexingFlag(): Promise<{
    message: string;
    previousState: boolean;
  }> {
    const previousState = this.isIndexing;
    this.isIndexing = false;
    this.logger.log('Indexing flag reset manually');
    return {
      message: 'Indexing flag reset successfully',
      previousState,
    };
  }
}
