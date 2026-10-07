import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProyectoIngenieria } from '../../ingenieria/entities/proyecto-ingenieria.entity';

export enum EstadoTarea {
  PENDIENTE = 'pendiente',
  EN_CURSO = 'en_curso',
  HECHA = 'hecha',
}

@Entity('tareas')
export class Tarea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'enum', enum: EstadoTarea, default: EstadoTarea.PENDIENTE })
  estado: EstadoTarea;

  // Disciplina a la que pertenece la tarea (climatizacion, electricidad, ...)
  @Column({ nullable: true })
  disciplina: string;

  // Responsables de la tarea: personal de Ingenieria (Alejandro, Lorena, Miguel,
  // Sergio, Ariel, Salva). Lista porque puede llevarla mas de una persona.
  @Column({ type: 'simple-array', nullable: true })
  responsables: string[];

  @Column({ type: 'date', nullable: true })
  fecha_limite: Date;

  /**
   * El día en que hay que EMPEZAR la tarea (lo pone quien la asigna, en el panel: «Inicio»).
   * No confundir con `iniciada_en`, que es cuándo se puso en marcha de verdad: la fecha de inicio
   * se planifica, `iniciada_en` se fecha sola al pasar la tarea a «en curso».
   * Lo pidió Salva el 7-oct-2026: «en las tareas hace falta la pestaña de inicio».
   */
  @Column({ type: 'date', nullable: true })
  fecha_inicio: Date;

  /** Cuándo se puso en marcha (se fecha sola al pasar la tarea a «en curso»). */
  @Column({ type: 'timestamp', nullable: true })
  iniciada_en: Date;

  /** Cuándo se terminó (se fecha sola al pasar la tarea a «hecha»). */
  @Column({ type: 'timestamp', nullable: true })
  completada_en: Date;

  @Column({ nullable: true })
  proyecto_id: string;

  @ManyToOne(() => ProyectoIngenieria, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: ProyectoIngenieria;

  @Column({ nullable: true })
  operario_id: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'operario_id' })
  operario: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
