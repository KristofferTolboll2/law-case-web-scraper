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
    this.delay = 0;
    this.timeout = parseInt(
      this.configService.get('SCRAPER_TIMEOUT_MS', '15000'),
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
      waitUntil: 'domcontentloaded',
      timeout: this.timeout,
    });

    if (!response?.ok()) {
      throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
    }

    const content = await page.content();
    await page.close();

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
      waitUntil: 'domcontentloaded',
      timeout: this.timeout,
    });

    if (!response?.ok()) {
      throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
    }

    await this.waitForSearchResults(page);

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

      await this.waitForNewContent(page);

      content = await page.content();
      htmlBatches.push(content);
      this.logger.log(`Captured batch ${batch}/${maxBatches}`);
    }

    await page.close();
    this.logger.log(
      `Successfully captured ${htmlBatches.length} content batches`,
    );

    return htmlBatches;
  }

  private async waitForSearchResults(page: Page): Promise<void> {
    await page.waitForSelector('a.full-link, a[href*="/afgoerelse/"]', {
      timeout: 5000,
    });
  }

  private async clickSeFlerButton(page: Page): Promise<boolean> {
    try {
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

      await page.click('#view-more');
      this.logger.log('Successfully clicked "se flere" button');
      return true;
    } catch (error) {
      this.logger.debug(`No "se flere" button found: ${error.message}`);
      return false;
    }
  }

  private async waitForNewContent(page: Page): Promise<void> {
    await page.waitForNetworkIdle({ timeout: 3000, idleTime: 100 });
  }

  async fetchCasePage(url: string): Promise<string> {
    await this.initBrowser();
    const page = await this.browser!.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    await page.setViewport({ width: 1920, height: 1080 });

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: this.timeout,
    });

    if (!response?.ok()) {
      throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
    }

    // Optional wait for app-root - don't fail if it doesn't exist
    try {
      await page.waitForSelector('app-root', { timeout: 3000 });
    } catch (error) {
      // Continue anyway - some pages might not have app-root
      this.logger.debug(
        `app-root selector not found, continuing anyway: ${error.message}`,
      );
    }

    const content = await page.content();
    await page.close();

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
