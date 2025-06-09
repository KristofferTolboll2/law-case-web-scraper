import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { CaseContent } from './case-content.entity';

@Entity('cases')
export class Case {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  mfknId: string;

  @Column()
  title: string;

  @Column({ name: 'case_number', nullable: true })
  caseNumber: string;

  @Column({ type: 'date', nullable: true })
  decisionDate: Date;

  @Column({ name: 'source_url' })
  sourceUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => CaseContent, (content) => content.case, {
    cascade: true,
    eager: false,
  })
  content?: CaseContent;
}
