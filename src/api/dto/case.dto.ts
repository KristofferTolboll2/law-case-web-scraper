import {
  Field,
  ObjectType,
  InputType,
  Int,
  ID,
  GraphQLISODateTime,
} from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

@ObjectType()
export class CaseContentDto {
  @Field(() => [String])
  paragraphs: string[];

  @Field(() => [CaseLinkDto])
  links: CaseLinkDto[];

  @Field({ nullable: true })
  court?: string;

  @Field(() => [String])
  parties: string[];

  @Field(() => [String])
  keywords: string[];

  @Field()
  fullText: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

@ObjectType()
export class CaseLinkDto {
  @Field()
  text: string;

  @Field()
  url: string;

  @Field({ nullable: true })
  type?: string;
}

@ObjectType()
export class CaseResponseDto {
  @Field(() => ID)
  id: string;

  @Field()
  mfknId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  caseNumber?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  decisionDate: Date | null;

  @Field()
  sourceUrl: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  @Field(() => CaseContentDto, { nullable: true })
  content?: CaseContentDto;
}

@ObjectType()
export class PaginationMetaDto {
  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  totalPages: number;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;
}

@ObjectType()
export class PaginatedCasesResponseDto {
  @Field(() => [CaseResponseDto])
  data: CaseResponseDto[];

  @Field()
  meta: PaginationMetaDto;
}

@InputType()
export class CaseQueryInput {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  caseNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @Field({ nullable: true, defaultValue: 'decisionDate' })
  @IsOptional()
  @IsString()
  sortBy?: 'decisionDate' | 'createdAt' | 'title' = 'decisionDate';

  @Field({ nullable: true, defaultValue: 'desc' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Simplified GraphQL input type with only page and limit
@InputType()
export class SimpleCaseQueryInput {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
