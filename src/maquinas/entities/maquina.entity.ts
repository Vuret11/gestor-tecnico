import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Catalogo de maquinas, copiado del CRM (Ingeniero backend -> GET /maquinas).
// id_externo guarda el id del CRM para que los documentos salgan identicos.
@Entity('maquinas_catalogo')
export class Maquina {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true, unique: true })
  id_externo: number;

  @Column({ nullable: true })
  fabricante: string;

  @Column({ nullable: true })
  gama: string;

  @Column({ nullable: true })
  modelo: string;

  @Column({ nullable: true })
  codigo_fabricante: string;

  @Column({ nullable: true })
  tipo_uso: string;

  @Column({ nullable: true })
  refrigerante: string;

  // --- ampliado 2026-10-02: los documentos oficiales (RSIF, IF-190, MOD-315/318) necesitan
  // estos datos de la maquina, no solo las potencias. Copiados del CRM tal cual.
  @Column({ type: 'float', nullable: true })
  gwp_refrigerante: number;

  @Column({ type: 'float', nullable: true })
  carga_refrigerante_kg: number;

  @Column({ nullable: true })
  alimentacion: string;

  @Column({ type: 'float', nullable: true })
  scop_medio_35c: number;

  @Column({ type: 'float', nullable: true })
  scop_dhw_medio: number;

  @Column({ type: 'boolean', nullable: true })
  cumple_scop_dhw_25: boolean;

  @Column({ nullable: true })
  scop_dhw_origen: string;

  @Column({ nullable: true })
  acs_no_disponible_motivo: string;

  @Column({ type: 'jsonb', nullable: true })
  datos_variante: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  datos_gama: Record<string, unknown>;

  @Column({ nullable: true })
  fuente_documento: string;

  @Column({ nullable: true })
  fuente_url: string;

  @Column({ nullable: true })
  fuente_paginas: string;

  @Column({ type: 'float', nullable: true })
  potencia_calorifica_kw: number;

  @Column({ type: 'float', nullable: true })
  potencia_frigorifica_kw: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
