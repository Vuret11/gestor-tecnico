import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum EstadoLegalizacion {
  BLOQUEADO = 'bloqueado',
  CON_AVISOS = 'con_avisos',
  LISTO_PRESENTAR = 'listo_presentar',
  PRESENTADO = 'presentado',
  INSCRITO = 'inscrito',
}

@Entity('legalizaciones')
export class Legalizacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Numero de expediente del CRM (para no duplicar al sincronizar)
  @Column({ type: 'int', nullable: true })
  id_externo: number;

  @Column({ nullable: true })
  cliente: string;

  // Titular de la instalacion: para la autorizacion y el MOD-315 hace falta el NIF
  @Column({ nullable: true })
  nif: string;

  // Fase del tramite: sin fecha_inicio = por iniciar; con inicio y sin fin = en tramite;
  // con fecha_fin = finalizada
  @Column({ type: 'date', nullable: true })
  fecha_inicio: string;

  @Column({ type: 'date', nullable: true })
  fecha_fin: string;

  // Quien creo el tramite (queda guardado el nombre, no se toca al reasignar responsable)
  @Column({ nullable: true })
  creado_por: string;

  // Tipo de emisor: valores del CRM (normativa/demanda.constants -> TipoEmisor)
  @Column({ nullable: true })
  tipo_emisor: string;

  // Campos que pide la documentacion (identicos al CRM): comunidad, superficie,
  // tipo de edificio, dormitorios y las tres clasificaciones del RSIF
  @Column({ nullable: true })
  comunidad: string;

  @Column({ type: 'float', nullable: true })
  superficie: number;

  @Column({ nullable: true })
  tipo_edificio: string;

  @Column({ type: 'int', nullable: true })
  dormitorios: number;

  @Column({ nullable: true })
  clasificacion_emplazamiento: string;

  @Column({ nullable: true })
  clasificacion_local: string;

  @Column({ nullable: true })
  sala_maquinas: string;


  @Column({ nullable: true })
  direccion: string;

  /**
   * Dirección del cliente TROCEADA, como la mandaba el instalador: `direccion` es SOLO el nombre de
   * la vía y cada trozo va a su propia casilla de los puntos 1 y 3 del MOD-315 (y del MOD-318). Un
   * trozo que no venga deja su casilla vacía: nunca se adivina recortando la dirección completa.
   */
  @Column({ nullable: true })
  tipo_via: string;

  @Column({ nullable: true })
  numero: string;

  @Column({ nullable: true })
  bloque: string;

  @Column({ nullable: true })
  portal: string;

  @Column({ nullable: true })
  escalera: string;

  @Column({ nullable: true })
  piso: string;

  @Column({ nullable: true })
  puerta: string;

  @Column({ nullable: true })
  cp: string;

  // Numero de obra con el que se identifica en HomeServe, y partner que la trae
  @Column({ nullable: true })
  num_obra: string;

  @Column({ nullable: true })
  partner: string;

  @Column({ nullable: true })
  municipio: string;

  @Column({ nullable: true })
  provincia: string;

  @Column({ nullable: true })
  oca: string;

  @Column({ nullable: true })
  maquina: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  potencia: number;

  @Column({ default: false })
  hidraulica: boolean;

  @Column({ type: 'enum', enum: EstadoLegalizacion, default: EstadoLegalizacion.BLOQUEADO })
  estado: EstadoLegalizacion;

  @Column({ type: 'int', default: 0 })
  n_listo: number;

  @Column({ type: 'int', default: 0 })
  n_avisos: number;

  @Column({ type: 'int', default: 0 })
  n_bloqueado: number;

  @Column({ type: 'int', default: 0 })
  n_total: number;

  @Column({ nullable: true, type: 'text' })
  motivo: string;

  @Column({ type: 'int', nullable: true })
  dias: number;

  @Column({ default: false })
  parado: boolean;

  @Column({ nullable: true, type: 'text' })
  notas: string;

  // Ingeniero responsable (Alejandro, Lorena, Miguel, Sergio, Ariel, Salva)
  @Column({ nullable: true })
  responsable: string;

  @Column({ default: true })
  activo: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Datos que exigen los documentos oficiales (añadidos 2026-10-02).
  // Sin ellos los PDFs salen con campos en blanco: no se inventan nunca.
  // ─────────────────────────────────────────────────────────────────────────────

  /** Email y teléfono del titular (los pide la autorización y el MOD-315). */
  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  telefono: string;

  /** CIF de la OCA (la autorización y el RSIF lo imprimen). */
  @Column({ nullable: true })
  oca_cif: string;

  /** ¿La instalación es anterior a la entrada en vigor del RD 1027/2007? (MOD-315, declaración) */
  @Column({ type: 'boolean', nullable: true })
  es_anterior_rd: boolean;

  /**
   * Tipo de energía de la instalación: 'AEROTERMIA' o 'GEOTERMIA' (nunca las dos).
   * El instalador lo indicó el 2-oct-2026: marca la casilla del punto 7 de la memoria del 315
   * (Aerotermia/Geotermia) y elige el texto de OBSERVACIONES del punto 1.
   */
  @Column({ nullable: true, default: 'AEROTERMIA' })
  tipo_energia: string;

  /**
   * Tipo de instalación: 'NUEVA' o 'REFORMA' (cambio de caldera a aerotermia sin modificar la
   * instalación interior). Marca la casilla del punto 1 de la memoria del 315 y el IF-190 y
   * decide el texto de OBSERVACIONES. Si no se dice nada se deduce de `es_anterior_rd`.
   */
  @Column({ nullable: true, default: 'NUEVA' })
  tipo_instalacion: string;

  /** Nº de viviendas cuando el edificio es plurifamiliar (MOD-315). */
  @Column({ type: 'int', nullable: true })
  viviendas: number;

  /**
   * Uso declarado de la instalación (los del catálogo): 'CLIMATIZACION_ACS', 'SOLO_ACS'… Decide si
   * se marcan las casillas de ACS y si el bloque de ACS del MOD-318 lleva COP. Si no se dice nada
   * se deduce del uso de la máquina.
   */
  @Column({ nullable: true })
  tipo_uso: string;

  /** Máquina principal: id del catálogo (tabla maquinas_catalogo). */
  @Column({ type: 'int', nullable: true })
  maquina_id: number;

  /** Máquinas de la instalación con sus unidades: [{ maquina_id, unidades }]. Si está vacío se
   *  usa `maquina_id` con 1 unidad. Potencias, carga de refrigerante y tCO₂eq SUMAN. */
  @Column({ type: 'jsonb', nullable: true })
  maquinas_instalacion: { maquina_id: number; unidades: number }[];

  /** Datos medidos en obra por el instalador para el MOD-318 (fechas de pruebas, presiones
   *  de prueba, EER/COP medidos). Mismas claves que el CRM (`datosObra`). */
  @Column({ type: 'jsonb', nullable: true })
  datos_obra: Record<string, unknown>;

  // Cálculos del CTE: en el CRM los produce el motor RITE (cálculo de ACS y de demanda).
  // Aquí se rellenan a mano hasta que se porte la calculadora. Van al MOD-315 y al IF-190.
  @Column({ type: 'float', nullable: true })
  qusable_anual_kwh: number;

  @Column({ type: 'float', nullable: true })
  eres_anual_kwh: number;

  @Column({ type: 'float', nullable: true })
  acs_demanda_diaria_60c: number;

  @Column({ type: 'float', nullable: true })
  acs_volumen_acumulador_l: number;

  /** Si no se dice nada, se deduce del uso de la máquina (climatización + ACS / solo ACS). */
  @Column({ type: 'boolean', nullable: true })
  tiene_calefaccion: boolean;

  @Column({ type: 'boolean', nullable: true })
  tiene_acs: boolean;

  /** Si no se dice nada, se calcula con el ámbito de potencia (igual que el CRM). */
  @Column({ type: 'boolean', nullable: true })
  requiere_memoria_tecnica: boolean;

  /** Qué documentos se han generado y cuándo: { 'mod-315': '2026-10-02T…', … } */
  @Column({ type: 'jsonb', nullable: true })
  documentos_generados: Record<string, string>;

  /**
   * Observaciones del trámite, una por línea con su fecha delante («06/10/2026 · enviado al cliente
   * para firmar»). Lo pidió Ariel por medio de Salva (6-oct-2026): es el «rollo del Excel», la
   * columna donde se va apuntando qué ha pasado con cada trámite. Se añaden desde la ficha y el
   * programa pone la fecha solo.
   */
  @Column({ type: 'text', nullable: true })
  observaciones: string;

  /**
   * Si el trámite está FACTURADO. Lo pidió Salva el 7-oct-2026 para el listado en tabla: «debemos ver
   * en una columna más si está facturada». Se marca desde el propio listado (pulsando la casilla) y
   * desde la ficha del trámite (al editarla).
   */
  @Column({ type: 'boolean', default: false })
  facturada: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
