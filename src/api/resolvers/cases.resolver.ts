import { Query, Resolver, Args, ID } from '@nestjs/graphql';
import { CasesService } from '../services/cases.service';
import {
  CaseQueryInput,
  PaginatedCasesResponseDto,
  CaseResponseDto,
} from '../dto/case.dto';

@Resolver(() => CaseResponseDto)
export class CasesResolver {
  constructor(private readonly casesService: CasesService) {}

  @Query(() => PaginatedCasesResponseDto, { name: 'cases' })
  async findAll(@Args('query') query: CaseQueryInput) {
    return this.casesService.findAll(query);
  }

  @Query(() => CaseResponseDto, { name: 'caseById' })
  async findById(@Args('id', { type: () => ID }) id: string) {
    return this.casesService.findById(id);
  }

  @Query(() => CaseResponseDto, { name: 'caseByMfknId' })
  async findByMfknId(@Args('mfknId') mfknId: string) {
    return this.casesService.findByMfknId(mfknId);
  }
}
