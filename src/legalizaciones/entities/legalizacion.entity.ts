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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
