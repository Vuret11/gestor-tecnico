import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ProyectoIngenieria } from './proyecto-ingenieria.entity';

/** Plazos de retención de garantía que se usan en obra. */
export const PLAZOS_RETENCION = ['6_meses', '1_ano'] as const;
export type PlazoRetencion = typeof PLAZOS_RETENCION[number];

export const ESTADOS_RETENCION = ['pendiente', 'liberada'] as const;
export type EstadoRetencion = typeof ESTADOS_RETENCION[number];

/** Retención de garantía de una obra: importe, plazo, vencimiento y si ya se ha liberado. */
@Entity('retenciones')
export class Retencion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  obra_id: string;

  @ManyToOne(() => ProyectoIngenieria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obra_id' })
  obra: ProyectoIngenieria;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  importe: number | null;

  /** '6_meses' o '1_ano'. */
  @Column({ type: 'varchar', nullable: true })
  plazo: string | null;

  @Column({ type: 'date', nullable: true })
  fecha_vencimiento: Date | null;

  /** 'pendiente' o 'liberada'. */
  @Column({ default: 'pendiente' })
  estado: string;

  @Column({ type: 'date', nullable: true })
  fecha_liberacion: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
