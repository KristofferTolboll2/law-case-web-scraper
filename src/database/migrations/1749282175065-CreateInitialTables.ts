import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialTables1749282175065 implements MigrationInterface {
  name = 'CreateInitialTables1749282175065';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "cases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mfknId" character varying NOT NULL,
        "title" character varying NOT NULL,
        "case_number" character varying,
        "decisionDate" date,
        "source_url" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_cases_mfknId" UNIQUE ("mfknId"),
        CONSTRAINT "PK_cases" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "case_content" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "caseId" uuid NOT NULL,
        "paragraphs" text array NOT NULL DEFAULT '{}',
        "parties" text array NOT NULL DEFAULT '{}',
        "keywords" text array NOT NULL DEFAULT '{}',
        "links" jsonb NOT NULL DEFAULT '[]',
        "court" text,
        "fullText" text NOT NULL DEFAULT '',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_case_content" PRIMARY KEY ("id"),
        CONSTRAINT "REL_case_content_caseId" UNIQUE ("caseId")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "case_content" 
      ADD CONSTRAINT "FK_case_content_caseId" 
      FOREIGN KEY ("caseId") REFERENCES "cases"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "case_content" DROP CONSTRAINT "FK_case_content_caseId"`,
    );
    await queryRunner.query(`DROP TABLE "case_content"`);
    await queryRunner.query(`DROP TABLE "cases"`);
  }
}
