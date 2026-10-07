import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';
import type { Empresa, Persona } from './crm/tipos';

/**
 * Configuración fija de los documentos: la empresa instaladora y las personas con rol
 * (técnico, apoderado, instalador habilitado).
 *
 * Traída del CRM una sola vez (tabla `legalizacion_empresa` y `legalizacion_personas`).
 * Es una sola fila: la fila 1.
 */
@Entity('config_documentos')
export class ConfigDocumentos {
  @PrimaryGeneratedColumn()
  id: number;

  /** Nombre, CIF, dirección, teléfono, email y nº de registro de empresa instaladora. */
  @Column({ type: 'jsonb', nullable: true })
  empresa: Empresa;

  /** Técnico, apoderado e instalador habilitado (con su DNI y dirección). */
  @Column({ type: 'jsonb', nullable: true })
  personas: Persona[];

  @UpdateDateColumn()
  updatedAt: Date;
}
