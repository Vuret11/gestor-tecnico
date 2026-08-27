import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { PlanCliente } from './plan-cliente.entity';
import { PlanProvincia } from './plan-provincia.entity';

export type EstadoObra =
  | 'pendiente' | 'planificada' | 'confirmada'
  | 'en_curso' | 'realizada' | 'cancelada' | 'reprogramada';

export type TipoTrabajo = 'instalacion_fv' | 'instalacion_aerotermia' | 'mantenimiento' | 'incidencia' | 'visita_tecnica' | 'otro';

@Entity('plan_obras')
export class PlanObra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  numeroObra: string;

  @Column()
  nombre: string;

  @ManyToOne(() => PlanCliente, { eager: true, nullable: true })
  @JoinColumn({ name: 'cliente_id' })
  cliente: PlanCliente;

  @Column({ nullable: true })
  cliente_id: string;

  @ManyToOne(() => PlanProvincia, { eager: true, nullable: true })
  @JoinColumn({ name: 'provincia_id' })
  provincia: PlanProvincia;

  @Column({ nullable: true })
  provincia_id: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ nullable: true })
  ciudad: string;

  @Column({ type: 'varchar', default: 'otro' })
  tipoTrabajo: TipoTrabajo;

  @Column({ type: 'varchar', default: 'pendiente' })
  estado: EstadoObra;

  @Column({ type: 'date', nullable: true })
  fechaPrevista: string;

  @Column({ type: 'date', nullable: true })
  fechaRealizada: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
