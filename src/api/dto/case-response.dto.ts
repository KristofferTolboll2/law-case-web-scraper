export class CaseContentDto {
  paragraphs: string[];
  links: { text: string; url: string; type?: string }[];
  court?: string;
  parties: string[];
  keywords: string[];
  fullText: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CaseResponseDto {
  id: string;
  mfknId: string;
  title: string;
  caseNumber?: string;
  decisionDate: Date;
  sourceUrl: string;
  createdAt: Date;
  updatedAt: Date;
  content?: CaseContentDto; // Optional - only present if enriched
}

export class PaginationMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class PaginatedCasesResponseDto {
  data: CaseResponseDto[];
  meta: PaginationMetaDto;
}
