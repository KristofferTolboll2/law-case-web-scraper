import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser, Page } from 'puppeteer';

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private browser: Browser | null = null;
  private readonly delay: number;
  private readonly timeout: number;

  constructor(private configService: ConfigService) {
    this.delay = parseInt(this.configService.get('SCRAPER_DELAY_MS', '200'));
    this.timeout = parseInt(
      this.configService.get('SCRAPER_TIMEOUT_MS', '30000'),
    );
  }

  async initBrowser(): Promise<void> {
    if (!this.browser || this.browser.process()?.killed) {
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (error) {
          this.logger.warn('Error closing existing browser:', error.message);
        }
        this.browser = null;
      }

      this.logger.log('Initializing Puppeteer browser...');

      // Simplified working configuration
      const browserOptions = {
        headless: 'new' as const,
        timeout: 60000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      };

      this.logger.debug(
        `Launching browser with options: ${JSON.stringify(browserOptions, null, 2)}`,
      );

      this.browser = await puppeteer.launch(browserOptions);
      this.logger.log('✅ Browser launched successfully');

      // Handle browser disconnects
      this.browser.on('disconnected', () => {
        this.logger.warn(
          'Browser disconnected, will reinitialize on next request',
        );
        this.browser = null;
      });
    }
  }

  async fetchPage(url: string): Promise<string> {
    await this.initBrowser();
    const page = await this.browser!.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    await page.setViewport({ width: 1920, height: 1080 });

    this.logger.log(`Fetching: ${url}`);

    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: this.timeout,
    });

    if (!response?.ok()) {
      throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
    }

    const content = await page.content();
    await page.close();

    // Rate limiting
    await this.sleep(this.delay);

    return content;
  }

  async fetchSearchPageWithInfiniteScroll(
    url: string,
    maxBatches = 2,
  ): Promise<string[]> {
    const htmlBatches: string[] = [];

    await this.initBrowser();
    const page = await this.browser!.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    await page.setViewport({ width: 1920, height: 1080 });

    this.logger.log(`Fetching search page with infinite scroll: ${url}`);

    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: this.timeout,
    });

    if (!response?.ok()) {
      throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
    }

    // Wait for initial search results to load
    await this.waitForSearchResults(page);

    // Get initial batch of content
    let content = await page.content();
    htmlBatches.push(content);
    this.logger.log(`Captured initial batch (1/${maxBatches})`);

    // Progressive loading with "se flere" button
    for (let batch = 2; batch <= maxBatches; batch++) {
      const hasMoreContent = await this.clickSeFlerButton(page);

      if (!hasMoreContent) {
        this.logger.log(
          'No more "se flere" button found - reached end of content',
        );
        break;
      }

      // Wait for new content to load
      await this.waitForNewContent(page, batch);

      // Capture updated page content
      content = await page.content();
      htmlBatches.push(content);
      this.logger.log(`Captured batch ${batch}/${maxBatches}`);

      // Rate limiting between clicks
      await this.sleep(this.delay);
    }

    await page.close();
    this.logger.log(
      `Successfully captured ${htmlBatches.length} content batches`,
    );

    return htmlBatches;
  }

  private async waitForSearchResults(page: Page): Promise<void> {
    this.logger.log('Waiting for MFKN search results to load...');

    // Wait for MFKN case links to appear
    await page.waitForSelector('a.full-link, a[href*="/afgoerelse/"]', {
      timeout: 15000,
    });

    // Ensure we have actual content loaded
    await page.waitForFunction(
      () => {
        const caseLinks = document.querySelectorAll(
          'a.full-link, a[href*="/afgoerelse/"]',
        );
        return caseLinks.length > 0;
      },
      { timeout: 10000 },
    );

    this.logger.log('MFKN search results loaded successfully');
  }

  private async clickSeFlerButton(page: Page): Promise<boolean> {
    try {
      // Wait for the specific MFKN "se flere" button
      await page.waitForSelector('#view-more', {
        visible: true,
        timeout: 5000,
      });

      // Ensure the button is clickable
      const isClickable = await page.evaluate(() => {
        const button = document.getElementById(
          'view-more',
        ) as HTMLButtonElement;
        return button && !button.disabled && button.offsetParent !== null;
      });

      if (!isClickable) {
        this.logger.debug('Se flere button found but not clickable');
        return false;
      }

      // Click the button
      await page.click('#view-more');
      this.logger.log('Successfully clicked "se flere" button');
      return true;
    } catch (error) {
      this.logger.debug(`No "se flere" button found: ${error.message}`);
      return false;
    }
  }

  private async waitForNewContent(
    page: Page,
    batchNumber: number,
  ): Promise<void> {
    this.logger.log(
      `Waiting for new content to load (batch ${batchNumber})...`,
    );

    // Wait for network activity to settle after button click
    await page.waitForNetworkIdle({ timeout: 10000, idleTime: 1000 });

    // Simple additional wait to ensure DOM is updated
    await this.sleep(1000);

    this.logger.log(`New content loaded for batch ${batchNumber}`);
  }

  async fetchCasePage(url: string): Promise<string> {
    await this.initBrowser();
    const page = await this.browser!.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    await page.setViewport({ width: 1920, height: 1080 });

    this.logger.debug(`Fetching case page: ${url}`);

    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: this.timeout,
    });

    if (!response?.ok()) {
      throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
    }

    // Wait for Angular app to load and render content
    await page.waitForSelector('app-root', { timeout: 10000 });

    // Wait a bit more for dynamic content to load
    await this.sleep(2000);

    const content = await page.content();
    await page.close();

    // Rate limiting for case pages
    await this.sleep(this.delay);

    return content;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('Browser closed');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }
}
