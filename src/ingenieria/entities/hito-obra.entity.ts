import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ProyectoIngenieria } from './proyecto-ingenieria.entity';

/**
 * Los 4 hitos con los que nace CUALQUIER obra, en este orden. Van sin fecha: el día se pone cuando
 * se sabe, y así el diagrama de Gantt ya trae su fila de hitos desde el primer día (lo pidió Salva
 * el 7-oct-2026: «los hitos de las obras en el diagrama deben salir por defecto»).
 */
export const HITOS_OBRA = [
  'Inicio',
  'Visita de OCA',
  'Inspección de la instalación',
  'Puesta en marcha',
] as const;

/**
 * Un hito de la obra: una fecha señalada que se quiere ver en el diagrama de Gantt (entrega de
 * planos a la dirección facultativa, visita de OCA, inspección, puesta en marcha…).
 *
 * `hecho` distingue el hito conseguido (rombo relleno) del que está por llegar (rombo hueco).
 */
@Entity('hitos_obra')
@Index(['obra_id', 'fecha'])
export class HitoObra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  obra_id: string;

  @ManyToOne(() => ProyectoIngenieria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obra_id' })
  obra: ProyectoIngenieria;

  @Column({ type: 'varchar' })
  nombre: string;

  @Column({ type: 'date', nullable: true })
  fecha: Date | null;

  @Column({ type: 'boolean', default: false })
  hecho: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
