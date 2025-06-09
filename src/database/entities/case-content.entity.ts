import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Case } from './case.entity';

export interface LinkData {
  text: string;
  url: string;
  type?: 'internal' | 'external';
}

@Entity('case_content')
export class CaseContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'caseId' })
  caseId: string;

  @Column({ type: 'text', array: true, default: [] })
  paragraphs: string[];

  @Column({ type: 'jsonb', nullable: true })
  links: LinkData[];

  @Column({ type: 'text', nullable: true })
  court: string;

  @Column({ type: 'text', array: true, default: [] })
  parties: string[];

  @Column({ type: 'text', array: true, default: [] })
  keywords: string[];

  @Column({ type: 'text', nullable: true })
  fullText: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => Case, (case_) => case_.content, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case: Case;
}
