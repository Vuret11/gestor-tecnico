import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Los cinco tipos de instalación del apartado de Homologaciones. Una obra puede llevar
 * VARIAS (se guardan todas en `instalaciones`), y cada una tiene su base normativa:
 * clima → RITE + CTE DB-HE · fontanería → CTE DB-HS4/HS5 · PCI → RIPCI + CTE DB-SI ·
 * teleco → ICT · electricidad → REBT y sus ITC-BT.
 */
export enum InstalacionHomologacion {
  CLIMA = 'clima',
  FONTANERIA = 'fontaneria',
  PCI = 'pci',
  TELECO = 'teleco',
  ELECTRICIDAD = 'electricidad',
}

/**
 * Estado del expediente. El módulo solo prepara el BORRADOR: el informe final lo revisa y
 * lo firma un técnico del departamento. Por eso hay un estado propio de «borrador emitido»
 * (pendiente de revisión técnica) antes de «revisada».
 */
export enum EstadoHomologacion {
  RECIBIDA = 'recibida',
  EN_REVISION = 'en_revision',
  BORRADOR_EMITIDO = 'borrador_emitido',
  CON_INCIDENCIAS = 'con_incidencias',
  REVISADA = 'revisada',
  CERRADA = 'cerrada',
}

/** Documentos que se suben a la obra: presupuesto/mediciones, planos y memorias, y los DWG. */
export interface ArchivoObra {
  nombre: string;
  /** 'excel' | 'pdf' | 'dwg' | 'otro' (los DWG se convierten a DXF al analizarlos). */
  tipo: string;
  bytes?: number;
  subido?: string;
  /** Nombre con el que el archivo está guardado en el disco de la Pi. */
  fichero?: string;
  /** Dónde se descarga: `/uploads/homologaciones/<id del trámite>/<fichero>`. */
  url?: string;
}

/** Los dos informes del apartado, con la fecha en que se emitieron. */
export interface InformesHomologacion {
  cumplimiento?: { generado: string; archivo?: string } | null;
  mediciones?: { generado: string; archivo?: string } | null;
}

@Entity('homologaciones')
export class Homologacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Número de obra con el que se identifica en HomeServe (lo escribe el departamento a mano). */
  @Column({ nullable: true })
  num_obra: string;

  /**
   * Obra de la que cuelga el trámite (`proyectos_ingenieria.id`). Un trámite se define SIEMPRE
   * por su obra: de ahí salen el titular, el número de obra, la dirección y las instalaciones que
   * hay que revisar. Puede ser nulo solo en las obras que todavía no están en el registro.
   */
  @Column({ type: 'uuid', nullable: true })
  proyecto_id: string;

  /** Nombre de la obra, copiado al crear el trámite (para listar y buscar sin cruzar tablas). */
  @Column({ nullable: true })
  proyecto_nombre: string;

  /** Titular o promotor que encarga la obra. */
  @Column({ nullable: true })
  cliente: string;

  /** Partner que trae la obra. */
  @Column({ nullable: true })
  partner: string;

  @Column({ nullable: true })
  nif: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ nullable: true })
  cp: string;

  @Column({ nullable: true })
  municipio: string;

  @Column({ nullable: true })
  provincia: string;

  /**
   * Instalaciones de la obra: una o varias de los cinco tipos. Es la clave del apartado
   * (los filtros y los grupos se cuentan por aquí).
   */
  @Column({ type: 'jsonb', nullable: true })
  instalaciones: string[];

  @Column({ type: 'enum', enum: EstadoHomologacion, default: EstadoHomologacion.RECIBIDA })
  estado: EstadoHomologacion;

  /** Quien creó el expediente (no cambia al reasignar responsable). */
  @Column({ nullable: true })
  creado_por: string;

  /** Técnico del departamento que revisa y firma el informe. */
  @Column({ nullable: true })
  responsable: string;

  @Column({ type: 'date', nullable: true })
  fecha_inicio: string;

  @Column({ type: 'date', nullable: true })
  fecha_fin: string;

  /** Documentación recibida de la obra (Excel de mediciones, PDF y DWG). */
  @Column({ type: 'jsonb', nullable: true })
  archivos: ArchivoObra[];

  /** Los dos informes generados: cumplimiento normativo y mediciones vs planos. */
  @Column({ type: 'jsonb', nullable: true })
  informes: InformesHomologacion;

  /**
   * Resultado del análisis de la documentación, instalación por instalación (un bloque por tipo:
   * clima, fontanería, PCI, teleco y electricidad). Es un BORRADOR hasta que lo firma un técnico.
   */
  @Column({ type: 'jsonb', nullable: true })
  resultados: any;

  /** Cuándo se lanzó el último análisis (nulo = todavía no se ha analizado la documentación). */
  @Column({ type: 'timestamptz', nullable: true })
  analizado_en: Date;

  // ── Resultado del informe de cumplimiento normativo ─────────────────────────
  /** Incumplimientos (seguros), dudas (falta información) y observaciones (mejora). */
  @Column({ type: 'int', default: 0 })
  n_incumplimientos: number;

  @Column({ type: 'int', default: 0 })
  n_dudas: number;

  @Column({ type: 'int', default: 0 })
  n_observaciones: number;

  // ── Resultado del informe de mediciones vs planos ───────────────────────────
  /** Impacto económico: a favor (se mide menos de lo presupuestado) y en contra. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impacto_favor: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impacto_contra: number;

  /** Partidas y elementos del DXF que no se han podido asociar a nada del Excel. */
  @Column({ type: 'int', default: 0 })
  n_no_asociados: number;

  @Column({ nullable: true, type: 'text' })
  motivo: string;

  @Column({ default: false })
  parado: boolean;

  @Column({ nullable: true, type: 'text' })
  notas: string;

  /**
   * Bitácora del expediente, una línea por nota con la fecha delante
   * («06/10/2026 · corregido el cálculo de la línea 3»). Es el «rollo del Excel».
   */
  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
