import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ChecklistPlantilla } from './checklist-plantilla.entity';
import { VisitaRespuesta } from './visita-respuesta.entity';

@Entity('visita_checklists')
export class VisitaChecklist {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() visitaId: string;
  @Column() plantillaId: string;
  @ManyToOne(() => ChecklistPlantilla, { eager: true }) plantilla: ChecklistPlantilla;
  @Column({ nullable: true }) firmante: string;
  @Column({ nullable: true }) completadoEn: Date;
  @OneToMany(() => VisitaRespuesta, r => r.checklist, { cascade: true })
  respuestas: VisitaRespuesta[];
  @CreateDateColumn() createdAt: Date;
}
