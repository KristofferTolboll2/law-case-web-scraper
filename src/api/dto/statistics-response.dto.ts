export class StatisticsResponseDto {
  totalCases: number;
  enrichedCases: number;
  pendingCases: number;
  latestCaseDate?: string;
  oldestCaseDate?: string;
  casesAddedToday: number;
  casesAddedThisWeek: number;
  casesAddedThisMonth: number;
}
