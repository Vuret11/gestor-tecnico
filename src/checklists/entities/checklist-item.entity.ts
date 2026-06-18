import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChecklistSeccion } from './checklist-seccion.entity';

export type ItemTipo = 'text' | 'number' | 'boolean' | 'select' | 'photo' | 'textarea';

@Entity('checklist_items')
export class ChecklistItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() etiqueta: string;
  @Column({ default: 'text' }) tipo: ItemTipo;
  @Column({ type: 'simple-json', nullable: true }) opciones: string[];
  @Column({ nullable: true }) unidad: string;
  @Column({ default: false }) obligatorio: boolean;
  @Column({ default: 0 }) orden: number;
  @Column() seccionId: string;
  @ManyToOne(() => ChecklistSeccion, s => s.items, { onDelete: 'CASCADE' })
  seccion: ChecklistSeccion;
}
