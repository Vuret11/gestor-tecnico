import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VisitaChecklist } from './visita-checklist.entity';
import { ChecklistItem } from './checklist-item.entity';

@Entity('visita_respuestas')
export class VisitaRespuesta {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() checklistId: string;
  @ManyToOne(() => VisitaChecklist, c => c.respuestas, { onDelete: 'CASCADE' }) checklist: VisitaChecklist;
  @Column() itemId: string;
  @ManyToOne(() => ChecklistItem, { eager: true }) item: ChecklistItem;
  @Column({ type: 'text', nullable: true }) valor: string | null;
}
