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

      // Use batches parameter directly - much more intuitive!
      const maxBatches = batches ? Math.min(batches, MAX_BATCHES) : MAX_BATCHES;

      this.logger.log(
        `Requested ${batches || 'all'} batches, fetching ${maxBatches} batches (~${maxBatches * CASES_PER_BATCH} cases max)`,
      );

      const searchUrl = this.buildSearchUrl();

      // Use infinite scroll to get all batches - each batch contains cumulative content
      const htmlBatches =
        await this.httpClient.fetchSearchPageWithInfiniteScroll(
          searchUrl,
          maxBatches,
        );

      if (htmlBatches.length === 0) {
        this.logger.log('No content batches retrieved');
        return { indexed: 0, skipped: 0 };
      }

      // Process only the final batch which contains ALL the accumulated content
      const finalBatch = htmlBatches[htmlBatches.length - 1];
      const allCases = this.parser.parseSearchResults(finalBatch);

      if (allCases.length === 0) {
        this.logger.log('No cases found in final batch');
        return { indexed: 0, skipped: 0 };
      }

      this.logger.log(
        `Found ${allCases.length} total cases across ${htmlBatches.length} scroll batches`,
      );

      // Apply cursor logic: find where to start processing (skip cases we already have)
      const startIndex = await this.findCursorPosition(allCases);

      if (startIndex === -1) {
        this.logger.log(
          'All cases already exist in database, nothing to process',
        );
        return { indexed: 0, skipped: allCases.length };
      }

      const newCases = allCases.slice(0, startIndex);
      const skippedCases = allCases.slice(startIndex);

      this.logger.log(
        `Processing ${newCases.length} new cases, skipping ${skippedCases.length} existing cases`,
      );

      const batchResult = await this.processBatch(newCases, caseLimit);
      totalIndexed = batchResult.indexed;
      totalSkipped = batchResult.skipped + skippedCases.length;

      this.logger.log(
        `Indexing completed. Total: ${totalIndexed} indexed, ${totalSkipped} skipped`,
      );

      return { indexed: totalIndexed, skipped: totalSkipped };
    } finally {
      this.isIndexing = false;
    }
  }

  private async findCursorPosition(cases: any[]): Promise<number> {
    this.logger.log(`Finding cursor position in ${cases.length} cases...`);

    // Check from the end (oldest) backwards to find the first case that doesn't exist
    for (let i = cases.length - 1; i >= 0; i--) {
      const caseExists = await this.caseExists(cases[i].id);
      if (!caseExists) {
        // Found first case that doesn't exist, return index + 1 as cursor position
        this.logger.log(
          `Cursor position found at index ${i + 1} (case ${cases[i].id} is new)`,
        );
        return i + 1;
      }
    }

    // All cases already exist
    this.logger.log('All cases already exist in database');
    return -1;
  }

  private async caseExists(mfknId: string): Promise<boolean> {
    const count = await this.caseRepository.count({
      where: { mfknId },
    });
    return count > 0;
  }

  private async processBatch(
    cases: any[],
    remainingLimit?: number,
  ): Promise<{ indexed: number; skipped: number }> {
    // Respect the limit by slicing the cases array
    const casesToProcess = remainingLimit
      ? cases.slice(0, remainingLimit)
      : cases;

    this.logger.log(
      `Processing ${casesToProcess.length} cases in FULL PARALLEL (with full content)...`,
    );

    // Process ALL cases in parallel using Promise.allSettled
    const startTime = Date.now();
    const allResults = await Promise.allSettled(
      casesToProcess.map(async (caseItem, index) => {
        try {
          // Fetch the full case content from individual case page
          this.logger.debug(
            `[${index + 1}/${casesToProcess.length}] Fetching full content for case: ${caseItem.id}`,
          );
          const casePageHtml = await this.httpClient.fetchCasePage(
            caseItem.url,
          );
          const caseContent = this.caseContentParser.parseContent(casePageHtml);

          // Use transaction to save both case and content atomically
          await this.dataSource.transaction(
            async (transactionalEntityManager) => {
              // Create and save the case
              const newCase = this.caseRepository.create({
                mfknId: caseItem.id,
                title: caseItem.title,
                caseNumber: caseItem.caseNumber || null,
                decisionDate: caseItem.decisionDate,
                sourceUrl: caseItem.url,
              });

              const savedCase = await transactionalEntityManager.save(
                Case,
                newCase,
              );

              // Create and save the case content
              const newCaseContent = this.caseContentRepository.create({
                caseId: savedCase.id,
                paragraphs: caseContent.paragraphs,
                links: caseContent.links,
                court: caseContent.court,
                parties: caseContent.parties,
                keywords: caseContent.keywords,
                fullText: caseContent.fullText,
              });

              await transactionalEntityManager.save(
                CaseContent,
                newCaseContent,
              );
            },
          );

          this.logger.debug(
            `✅ [${index + 1}/${casesToProcess.length}] Inserted case: ${caseItem.title.substring(0, 50)}...`,
          );
          return {
            success: true,
            caseId: caseItem.id,
            title: caseItem.title.substring(0, 50),
            index: index + 1,
          };
        } catch (error) {
          // Handle duplicate key errors gracefully
          if (
            error.code === '23505' ||
            error.message.includes('duplicate key')
          ) {
            this.logger.debug(
              `[${index + 1}/${casesToProcess.length}] Case ${caseItem.id} already exists, skipped`,
            );
            return {
              success: false,
              skipped: true,
              caseId: caseItem.id,
              index: index + 1,
            };
          } else {
            this.logger.error(
              `❌ [${index + 1}/${casesToProcess.length}] Error processing case ${caseItem.id}: ${error.message}`,
            );
            return {
              success: false,
              skipped: false,
              caseId: caseItem.id,
              error: error.message,
              index: index + 1,
            };
          }
        }
      }),
    );

    const processingTime = Date.now() - startTime;

    // Count and log results
    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    const failedCases: string[] = [];

    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          indexed++;
        } else if (result.value.skipped) {
          skipped++;
        } else {
          failed++;
          failedCases.push(`${result.value.caseId} (${result.value.error})`);
        }
      } else {
        failed++;
        failedCases.push(`Promise rejected: ${result.reason}`);
      }
    }

    // Add any remaining cases that weren't processed due to limit
    if (remainingLimit && cases.length > remainingLimit) {
      skipped += cases.length - remainingLimit;
    }

    this.logger.log(
      `🚀 FULL PARALLEL processing complete in ${processingTime}ms: ${indexed} inserted, ${skipped} skipped, ${failed} failed`,
    );

    // Log failed cases for debugging
    if (failed > 0) {
      this.logger.warn(`Failed cases (${failed} total):`);
      failedCases.forEach((failure, idx) => {
        if (idx < 5) {
          // Only log first 5 failures to avoid spam
          this.logger.warn(`  - ${failure}`);
        }
      });
      if (failed > 5) {
        this.logger.warn(`  ... and ${failed - 5} more failures`);
      }
    }

    return { indexed, skipped: skipped + failed };
  }

  async getCaseStats(): Promise<{
    total: number;
    enriched: number;
    pending: number;
  }> {
    const total = await this.caseRepository.count();
    const enriched = await this.caseRepository
      .createQueryBuilder('case')
      .innerJoin('case.content', 'content')
      .getCount();
    const pending = total - enriched;

    return { total, enriched, pending };
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
