import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ProyectoIngenieria } from './proyecto-ingenieria.entity';

/** Tipos de documento que se suben a una obra (la etiqueta que se pinta en el panel). */
export const TIPOS_DOCUMENTO = ['XLSX', 'PDF', 'DWG', 'OTRO'] as const;

/** Documento de la obra: presupuesto/mediciones (Excel), planos (PDF/DWG) o cualquier otro. */
@Entity('documentos')
export class DocumentoObra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  obra_id: string;

  @ManyToOne(() => ProyectoIngenieria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obra_id' })
  obra: ProyectoIngenieria;

  /** XLSX | PDF | DWG | OTRO. */
  @Column({ default: 'OTRO' })
  tipo: string;

  /** Nombre del archivo tal y como lo subió el usuario. */
  @Column()
  nombre: string;

  /** Nombre con el que está guardado en el disco de la Pi. */
  @Column({ type: 'varchar', nullable: true })
  fichero: string | null;

  /** Dónde se descarga: /uploads/obras/<obra>/<fichero>. */
  @Column({ type: 'varchar', nullable: true })
  ruta: string | null;

  @Column({ type: 'int', nullable: true })
  bytes: number | null;

  @CreateDateColumn()
  fecha_subida: Date;
}
