import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Cliente } from '../../clientes/entities/cliente.entity';

@Entity('instalaciones')
export class Instalacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  // Nombre libre (legado). Nullable cuando la instalación está vinculada via clienteId.
  @Column({ nullable: true })
  cliente: string;

  @Column()
  direccion: string;

  @Column()
  ciudad: string;

  @Column({ nullable: true })
  provincia: string;

  @Column({ nullable: true })
  cp: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitud: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitud: number;

  @Column({ type: 'text', nullable: true })
  notas: string;

  @ManyToOne(() => Cliente, { eager: true, nullable: true })
  @JoinColumn({ name: 'clienteId' })
  clienteData: Cliente;

  @Column({ nullable: true })
  clienteId: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
