import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { PlanTecnico } from './plan-tecnico.entity';
import { PlanObra } from './plan-obra.entity';
import { PlanProvincia } from './plan-provincia.entity';

export type EstadoEspecial =
  | 'vacaciones' | 'baja' | 'comp_horas' | 'libre'
  | 'fiesta_nacional' | 'medico' | 'sancion'
  | 'reconocimiento' | 'otros';

@Entity('plan_asignaciones')
export class PlanAsignacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PlanTecnico, { eager: true })
  @JoinColumn({ name: 'tecnico_id' })
  tecnico: PlanTecnico;

  @Column()
  tecnico_id: string;

  @ManyToOne(() => PlanObra, { eager: true, nullable: true })
  @JoinColumn({ name: 'obra_id' })
  obra: PlanObra;

  @Column({ nullable: true })
  obra_id: string;

  @Column({ type: 'date' })
  fecha: string;

  @ManyToOne(() => PlanProvincia, { eager: true, nullable: true })
  @JoinColumn({ name: 'provincia_trabajo_id' })
  provinciatrabajo: PlanProvincia;

  @Column({ nullable: true })
  provincia_trabajo_id: string;

  @Column({ type: 'varchar', nullable: true })
  estadoEspecial: EstadoEspecial | null;

  @Column({ default: false })
  viaja: boolean;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
