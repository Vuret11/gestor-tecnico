import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ChecklistPlantilla } from './checklist-plantilla.entity';
import { ChecklistItem } from './checklist-item.entity';

@Entity('checklist_secciones')
export class ChecklistSeccion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() titulo: string;
  @Column({ default: 0 }) orden: number;
  @Column() plantillaId: string;
  @ManyToOne(() => ChecklistPlantilla, p => p.secciones, { onDelete: 'CASCADE' })
  plantilla: ChecklistPlantilla;
  @OneToMany(() => ChecklistItem, i => i.seccion, { cascade: true, eager: true })
  items: ChecklistItem[];
}
