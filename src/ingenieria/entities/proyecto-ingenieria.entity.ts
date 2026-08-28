import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TipoProyecto {
  FV = 'fv',
  RITE = 'rite',
  AEROTERMIA = 'aerotermia',
  HIBRIDO = 'hibrido',
  OTRO = 'otro',
}

export enum EstadoProyecto {
  DISEÑO = 'diseño',
  PENDIENTE_APROBACION = 'pendiente_aprobacion',
  APROBADO = 'aprobado',
  EN_EJECUCION = 'en_ejecucion',
  COMPLETADO = 'completado',
  CANCELADO = 'cancelado',
}

@Entity('proyectos_ingenieria')
export class ProyectoIngenieria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column()
  cliente: string;

  @Column({ type: 'enum', enum: TipoProyecto, default: TipoProyecto.FV })
  tipo: TipoProyecto;

  @Column({ type: 'enum', enum: EstadoProyecto, default: EstadoProyecto.DISEÑO })
  estado: EstadoProyecto;

  @Column({ nullable: true, type: 'text' })
  descripcion: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  potencia_kwp: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  presupuesto: number;

  @Column({ type: 'date', nullable: true })
  fechaEntregaEstimada: Date;

  @Column({ nullable: true })
  direccion: string;

  @Column({ nullable: true })
  provincia: string;

  @Column({ nullable: true, type: 'text' })
  notas: string;

  @Column({ nullable: true })
  tecnico_id: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'tecnico_id' })
  tecnico: User;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
