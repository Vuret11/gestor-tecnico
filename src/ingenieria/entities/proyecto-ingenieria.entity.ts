import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TipoProyecto {
  FV = 'fv',
  RITE = 'rite',
  AEROTERMIA = 'aerotermia',
  HIBRIDO = 'hibrido',
  OTRO = 'otro',
}

export enum EstadoProyecto {
  DISEÑO = 'diseño',
  PENDIENTE_APROBACION = 'pendiente_aprobacion',
  APROBADO = 'aprobado',
  EN_EJECUCION = 'en_ejecucion',
  COMPLETADO = 'completado',
  CANCELADO = 'cancelado',
}

@Entity('proyectos_ingenieria')
export class ProyectoIngenieria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column()
  cliente: string;

  @Column({ type: 'enum', enum: TipoProyecto, default: TipoProyecto.FV })
  tipo: TipoProyecto;

  @Column({ type: 'enum', enum: EstadoProyecto, default: EstadoProyecto.DISEÑO })
  estado: EstadoProyecto;

  @Column({ nullable: true, type: 'text' })
  descripcion: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  potencia_kwp: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  presupuesto: number;

  @Column({ type: 'date', nullable: true })
  fechaEntregaEstimada: Date;

  @Column({ nullable: true })
  direccion: string;

  // Numero de obra: lo pone a mano el departamento (no viene de ningun sitio)
  @Column({ nullable: true })
  num_obra: string;

  // Estado real de la obra (los 9 del registro de obras) y su avance en %: para el cuadro
  // de mando por estado, igual que el informe en PDF
  @Column({ nullable: true })
  estado_obra: string;

  @Column({ type: 'int', nullable: true })
  progreso: number;

  // Jefe de obra de la constructora y su contacto (telefono o correo)
  @Column({ nullable: true })
  jefe_obra: string;

  @Column({ nullable: true })
  jefe_obra_contacto: string;

  @Column({ nullable: true })
  provincia: string;

  @Column({ nullable: true, type: 'text' })
  notas: string;

  // Disciplinas de la obra (mismo vocabulario que el registro de obras):
  // solar, electricidad, climatizacion, fontaneria, ventilacion, saneamiento, pci, telecom, aerotermia
  @Column({ type: 'simple-array', nullable: true })
  disciplinas: string[];

  // Responsables en Ingenieria (Alejandro, Lorena, Miguel, Sergio, Ariel, Salva).
  // Lista porque una obra puede llevarla mas de una persona.
  @Column({ type: 'simple-array', nullable: true })
  responsables: string[];

  @Column({ nullable: true })
  tecnico_id: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'tecnico_id' })
  tecnico: User;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
