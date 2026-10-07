import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Legalizacion } from './legalizacion.entity';

/**
 * Las tres fases por las que pasa una instalación de legalizaciones. Lo pidió Salva el 7-oct-2026:
 * «en cada ficha de legalización estén las siguientes fases: Inicio, Subida Portal y Finalizado.
 * Debe ser un botón y debe haber un registro de cada etapa».
 */
export enum EtapaLegalizacion {
  INICIO = 'inicio',
  SUBIDA_PORTAL = 'subida_portal',
  FINALIZADO = 'finalizado',
}

/** Las tres etapas con su rótulo y su explicación, en el orden en que se hacen. */
export const ETAPAS_LEGALIZACION: { etapa: EtapaLegalizacion; etiqueta: string; ayuda: string }[] = [
  {
    etapa: EtapaLegalizacion.INICIO,
    etiqueta: 'Inicio',
    ayuda: 'se ha empezado a preparar el trámite',
  },
  {
    etapa: EtapaLegalizacion.SUBIDA_PORTAL,
    etiqueta: 'Subida Portal',
    ayuda: 'los documentos están subidos al portal',
  },
  {
    etapa: EtapaLegalizacion.FINALIZADO,
    etiqueta: 'Finalizado',
    ayuda: 'el trámite está terminado',
  },
];

/**
 * REGISTRO de etapas de un trámite: **una fila por cada vez** que alguien marca o desmarca una etapa.
 * No se borra nada — es el histórico — así que el estado actual de una etapa es su ÚLTIMA fila.
 *
 * Se guarda a propósito el nombre del usuario además de su id: dentro de un año el histórico tiene que
 * seguir leyéndose aunque esa cuenta ya no exista.
 */
@Entity('legalizacion_etapas')
export class RegistroEtapaLegalizacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'legalizacion_id', type: 'uuid' })
  legalizacionId: string;

  @ManyToOne(() => Legalizacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'legalizacion_id' })
  legalizacion: Legalizacion;

  @Column({ type: 'enum', enum: EtapaLegalizacion })
  etapa: EtapaLegalizacion;

  /** `true` = con esta fila la etapa queda hecha; `false` = se desmarcó. */
  @Column({ type: 'boolean' })
  hecha: boolean;

  /** Quién lo hizo. */
  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  @Column({ name: 'usuario_nombre', type: 'varchar', nullable: true })
  usuarioNombre: string | null;

  /** Cuándo se pulsó el botón. */
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
