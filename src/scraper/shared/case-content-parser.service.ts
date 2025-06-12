import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { LinkData } from '../../database/entities/case-content.entity';

export interface ParsedCaseContent {
  paragraphs: string[];
  links: LinkData[];
  court?: string;
  parties: string[];
  keywords: string[];
  fullText: string;
}

@Injectable()
export class CaseContentParserService {
  private readonly logger = new Logger(CaseContentParserService.name);

  parseContent(html: string): ParsedCaseContent {
    const $ = cheerio.load(html);

    return {
      paragraphs: this.extractParagraphs($),
      links: this.extractLinks($),
      court: this.extractCourt($),
      parties: this.extractParties($),
      keywords: this.extractKeywords($),
      fullText: this.extractFullText($),
    };
  }

  private extractParagraphs($: cheerio.CheerioAPI): string[] {
    const paragraphs: string[] = [];

    $('p, .content p, [class*="paragraph"], [class*="text-content"] p').each(
      (_, element) => {
        const text = $(element).text().trim();
        if (text && text.length > 10) {
          // Filter out very short paragraphs
          paragraphs.push(text);
        }
      },
    );

    // If no paragraphs found, try looking for div elements with substantial text
    if (paragraphs.length === 0) {
      $('div').each((_, element) => {
        const text = $(element).text().trim();
        if (text && text.length > 100 && !$(element).find('div').length) {
          paragraphs.push(text);
        }
      });
    }

    return paragraphs;
  }

  private extractLinks($: cheerio.CheerioAPI): LinkData[] {
    const links: LinkData[] = [];

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();

      if (href && text) {
        const isInternal =
          href.startsWith('/') || href.includes('mfkn.naevneneshus.dk');

        links.push({
          text,
          url: href.startsWith('http')
            ? href
            : `https://mfkn.naevneneshus.dk${href}`,
          type: isInternal ? 'internal' : 'external',
        });
      }
    });

    return links;
  }

  private extractCourt($: cheerio.CheerioAPI): string | undefined {
    // Focus on the most common MFKN pattern
    const courtElement = $('span:contains("nævn")').first();
    if (courtElement.length > 0) {
      const court = courtElement.text().trim();
      if (court && court.length > 3) {
        return court;
      }
    }

    // Fallback: Look for text containing "nævn" in body
    const bodyText = $('body').text();
    const naevnMatch = bodyText.match(
      /([A-Z][a-zA-ZæøåÆØÅ\s]+nævn[a-zA-ZæøåÆØÅ\s]*)/,
    );
    if (naevnMatch) {
      return naevnMatch[1].trim();
    }

    return undefined;
  }

  private extractParties($: cheerio.CheerioAPI): string[] {
    const parties: string[] = [];

    const partySelectors = [
      '[class*="party"]',
      '[class*="plaintiff"]',
      '[class*="defendant"]',
      '.parties',
      '.case-parties',
      'dt:contains("Parter") + dd',
      'dt:contains("Sager") + dd',
    ];

    for (const selector of partySelectors) {
      $(selector).each((_, element) => {
        const text = $(element).text().trim();
        if (text) {
          // Split by common separators
          const splitParties = text.split(
            /\s+mod\s+|\s+vs?\s+|\s+contra\s+|;\s*|,\s*/,
          );
          splitParties.forEach((party) => {
            const cleanParty = party.trim();
            if (cleanParty && cleanParty.length > 2) {
              parties.push(cleanParty);
            }
          });
        }
      });
    }

    return [...new Set(parties)]; // Remove duplicates
  }

  private extractKeywords($: cheerio.CheerioAPI): string[] {
    const keywords: string[] = [];

    const keywordSelectors = [
      '[class*="keyword"]',
      '[class*="tag"]',
      '.keywords',
      '.tags',
      '.case-categories',
      'meta[name="keywords"]',
      'dt:contains("Nøgleord") + dd',
      'dt:contains("Emne") + dd',
    ];

    for (const selector of keywordSelectors) {
      $(selector).each((_, element) => {
        let text: string;

        if ($(element).is('meta')) {
          text = $(element).attr('content') || '';
        } else {
          text = $(element).text().trim();
        }

        if (text) {
          // Split by common separators
          const splitKeywords = text.split(/[,;]\s*|\s+[|]\s+/);
          splitKeywords.forEach((keyword) => {
            const cleanKeyword = keyword.trim();
            if (cleanKeyword && cleanKeyword.length > 2) {
              keywords.push(cleanKeyword);
            }
          });
        }
      });
    }

    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const heading = $(element).text().trim();
      if (heading && heading.length > 5 && heading.length < 100) {
        keywords.push(heading);
      }
    });

    return [...new Set(keywords)]; // Remove duplicates
  }

  private extractFullText($: cheerio.CheerioAPI): string {
    // Remove script and style elements
    $('script, style, nav, header, footer, .navigation, .menu').remove();

    const mainContent = $(
      'main, .main-content, .content, .case-content, body',
    ).first();

    const fullText = mainContent.text().replace(/\s+/g, ' ').trim();

    return fullText;
  }
}
