import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Prioridad, EstadoIncidencia } from '../../common/enums/prioridad.enum';
import { User } from '../../users/entities/user.entity';
import { Instalacion } from '../../instalaciones/entities/instalacion.entity';

@Entity('incidencias')
export class Incidencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titulo: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'enum', enum: Prioridad, default: Prioridad.MEDIA })
  prioridad: Prioridad;

  @Column({ type: 'enum', enum: EstadoIncidencia, default: EstadoIncidencia.ABIERTA })
  estado: EstadoIncidencia;

  @ManyToOne(() => Instalacion, { eager: true })
  @JoinColumn({ name: 'instalacion_id' })
  instalacion: Instalacion;

  @Column()
  instalacion_id: string;

  @Column({ nullable: true })
  visita_id: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'creado_por_id' })
  creadoPor: User;

  @Column()
  creado_por_id: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'asignado_a_id' })
  asignadoA: User;

  @Column({ nullable: true })
  asignado_a_id: string;

  @Column({ type: 'text', nullable: true })
  resolucion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
