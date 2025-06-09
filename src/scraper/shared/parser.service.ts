import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface CaseListItem {
  id: string;
  title: string;
  caseNumber: string;
  decisionDate: Date | null;
  url: string;
}

export interface ParsedCaseContent {
  paragraphs: string[];
  links: Array<{
    text: string;
    url: string;
    type: 'internal' | 'external';
  }>;
  court?: string;
  parties: string[];
  keywords: string[];
  fullText: string;
}

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);

  parseSearchResults(html: string): CaseListItem[] {
    const $ = cheerio.load(html);
    const cases: CaseListItem[] = [];

    $('a.full-link').each((_, element) => {
      const $element = $(element);

      // Extract title from h2.ruling-box-title
      const title = $element
        .find('h2.ruling-box-title')
        .text()
        .trim()
        .replace(/^"|"$/g, '');

      // Extract URL from href attribute
      const href = $element.attr('href') || '';
      const url = `https://mfkn.naevneneshus.dk${href}`;
      const id = this.extractCaseIdFromUrl(url);

      // Extract case number from .meta-journalnummer nested spans
      const caseNumber = $element.find('.meta-journalnummer').text().trim();

      // Extract date from .meta-datestamp
      const dateText = $element.find('.meta-datestamp').text().trim();
      const decisionDate = this.parseDate(dateText);

      if (title && id) {
        cases.push({
          id,
          title,
          caseNumber,
          decisionDate,
          url,
        });
      }
    });

    this.logger.log(`Parsed ${cases.length} cases from search results`);
    return cases;
  }

  parseCaseContent(html: string): ParsedCaseContent {
    const $ = cheerio.load(html);

    // Extract paragraphs
    const paragraphs: string[] = [];
    $('p, .paragraph, .content-paragraph').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        paragraphs.push(text);
      }
    });

    // Extract links
    const links: ParsedCaseContent['links'] = [];
    $('a[href]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text().trim();

      if (href && text) {
        const url = href.startsWith('http')
          ? href
          : `https://mfkn.naevneneshus.dk${href}`;

        const type = href.includes('mfkn.naevneneshus.dk')
          ? 'internal'
          : 'external';

        links.push({ text, url, type });
      }
    });

    // Extract court information
    const courtElement = $('.court-name, .institution, [data-court]').first();
    const court = courtElement.length ? courtElement.text().trim() : undefined;

    // Look for parties
    const partiesElements = $('.party, .parties, [data-parties]');
    const parties = partiesElements.length
      ? partiesElements.map((_, el) => $(el).text().trim()).get()
      : [];

    // Extract keywords/tags
    const keywordElements = $('.keyword, .tag, .category, [data-keywords]');
    const keywords = keywordElements.length
      ? keywordElements.map((_, el) => $(el).text().trim()).get()
      : [];

    // Generate full text for search
    const fullText = $('.case-content, .decision-content, .main-content, main')
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    return {
      paragraphs,
      links,
      court,
      parties,
      keywords,
      fullText: fullText || paragraphs.join(' '),
    };
  }

  private extractCaseIdFromUrl(url: string): string | null {
    // Handle MFKN URL patterns - they use UUIDs in the format: /afgoerelse/uuid
    const match = url.match(/\/afgoerelse\/([a-f0-9-]{36})/i);
    return match ? match[1] : null;
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Clean up the date string
    const cleaned = dateStr
      .trim()
      .replace(/^den\s+/i, '')
      .toLowerCase();

    // Danish month mapping
    const danishMonths = {
      januar: 'January',
      februar: 'February',
      marts: 'March',
      april: 'April',
      maj: 'May',
      juni: 'June',
      juli: 'July',
      august: 'August',
      september: 'September',
      oktober: 'October',
      november: 'November',
      december: 'December',
    };

    // Parse Danish format: "12. juni 2025"
    const danishPattern = /(\d{1,2})\.\s*(\w+)\s+(\d{4})/i;
    const danishMatch = cleaned.match(danishPattern);

    if (danishMatch) {
      const [, day, monthName, year] = danishMatch;
      const englishMonth = danishMonths[monthName.toLowerCase()];

      if (englishMonth) {
        const dateString = `${englishMonth} ${day}, ${year}`;
        const date = new Date(dateString);

        if (
          !isNaN(date.getTime()) &&
          date.getFullYear() > 1990 &&
          date.getFullYear() < 2030
        ) {
          return date;
        }
      }
    }

    return null;
  }
}
