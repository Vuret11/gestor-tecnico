import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ChecklistSeccion } from './checklist-seccion.entity';

export type TipoInstalacion = 'fv' | 'rite' | 'otro';

@Entity('checklist_plantillas')
export class ChecklistPlantilla {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() nombre: string;
  @Column({ nullable: true }) descripcion: string;
  @Column({ type: 'varchar', nullable: true }) tipoInstalacion: string | null;
  @Column({ default: true }) activo: boolean;
  @OneToMany(() => ChecklistSeccion, s => s.plantilla, { cascade: true, eager: true })
  secciones: ChecklistSeccion[];
  @CreateDateColumn() createdAt: Date;
}
