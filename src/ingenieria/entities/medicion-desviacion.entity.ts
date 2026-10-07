import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ProyectoIngenieria } from './proyecto-ingenieria.entity';

/**
 * Una partida del informe de mediciones vs planos: lo que dice el Excel, lo que sale del plano, la
 * diferencia y a cuánto sale ese desvío con el precio de la partida.
 */
@Entity('mediciones_desviacion')
export class MedicionDesviacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  obra_id: string;

  @ManyToOne(() => ProyectoIngenieria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obra_id' })
  obra: ProyectoIngenieria;

  @Column({ type: 'varchar', nullable: true })
  partida: string | null;

  @Column({ type: 'varchar', nullable: true })
  unidad: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, nullable: true })
  cantidad_excel: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, nullable: true })
  cantidad_plano: number | null;

  /** Diferencia en % (positiva = el plano pide más de lo presupuestado). */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  diferencia_pct: number | null;

  /** Impacto en € del desvío (negativo = cuesta dinero). */
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  impacto_eur: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
