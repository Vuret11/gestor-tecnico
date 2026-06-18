import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { Visita } from '../../visitas/entities/visita.entity';

@Entity('informes')
export class Informe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Visita, { eager: true })
  @JoinColumn({ name: 'visita_id' })
  visita: Visita;

  @Column()
  visita_id: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'text', nullable: true })
  trabajosRealizados: string;

  @Column({ type: 'text', nullable: true })
  materialesUsados: string;

  @Column({ type: 'int', nullable: true, comment: 'minutos' })
  tiempoEmpleado: number;

  @Column({ nullable: true })
  firmaClienteUrl: string;

  @Column({ nullable: true })
  nombreFirmante: string;

  @Column({ nullable: true })
  pdfUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
