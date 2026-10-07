import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ProyectoIngenieria } from './proyecto-ingenieria.entity';

/**
 * Las 7 fases de una obra, EN ESTE ORDEN (el orden manda). La fase actual de la obra es la primera
 * que no tiene fecha_fin_real, así que la tabla `fases_obra` es la que decide en qué punto está.
 */
export const FASES_OBRA = [
  { slug: 'documentacion_inicio', nombre: 'Documentación inicio' },
  { slug: 'normativa', nombre: 'Normativa' },
  { slug: 'homologaciones', nombre: 'Homologaciones' },
  { slug: 'inicio_obra', nombre: 'Inicio obra' },
  { slug: 'documentacion_asbuilt', nombre: 'Documentación as-built' },
  { slug: 'legalizacion', nombre: 'Legalización' },
  { slug: 'finalizacion_obra', nombre: 'Finalización obra' },
] as const;

/** La fase que decide si la obra está en curso o finalizada. */
export const FASE_FINALIZACION = 'finalizacion_obra';

@Entity('fases_obra')
@Index(['obra_id', 'orden'], { unique: true })
export class FaseObra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  obra_id: string;

  @ManyToOne(() => ProyectoIngenieria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obra_id' })
  obra: ProyectoIngenieria;

  /** Slug de la fase (documentacion_inicio, normativa, …). */
  @Column()
  fase: string;

  /** 1 a 7: el orden de la lista de arriba. */
  @Column({ type: 'int' })
  orden: number;

  @Column({ type: 'date', nullable: true })
  fecha_inicio_prevista: Date | null;

  @Column({ type: 'date', nullable: true })
  fecha_fin_prevista: Date | null;

  @Column({ type: 'date', nullable: true })
  fecha_inicio_real: Date | null;

  @Column({ type: 'date', nullable: true })
  fecha_fin_real: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
