import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ChecklistSeccion } from './checklist-seccion.entity';

@Entity('checklist_plantillas')
export class ChecklistPlantilla {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() nombre: string;
  @Column({ nullable: true }) descripcion: string;
  @Column({ default: true }) activo: boolean;
  @OneToMany(() => ChecklistSeccion, s => s.plantilla, { cascade: true, eager: true })
  secciones: ChecklistSeccion[];
  @CreateDateColumn() createdAt: Date;
}
