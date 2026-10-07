import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { ProyectoIngenieria } from './proyecto-ingenieria.entity';

/**
 * Nota de una obra: el bloc de notas de la ficha (lo que se apunta al vuelo — llamadas, acuerdos
 * con dirección facultativa, avisos de la visita de OCA…). No se edita la historia: cada nota se
 * guarda con quién la escribió y cuándo.
 */
@Entity('notas_obra')
export class NotaObra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  obra_id: string;

  @ManyToOne(() => ProyectoIngenieria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obra_id' })
  obra: ProyectoIngenieria;

  @Column({ type: 'text' })
  texto: string;

  /** Nombre de quien la escribe, tal y como lo manda el panel. */
  @Column({ type: 'varchar', nullable: true })
  autor: string | null;

  /** Id del usuario que la escribió (para poder filtrar por persona más adelante). */
  @Column({ type: 'uuid', nullable: true })
  autor_id: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
