import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Visita } from '../../visitas/entities/visita.entity';

@Entity('fotos')
export class Foto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Visita)
  @JoinColumn({ name: 'visita_id' })
  visita: Visita;

  @Column()
  visita_id: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  nombre: string;

  @Column({ default: 'foto' })
  tipo: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitud: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitud: number;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ nullable: true })
  informe_id: string;

  @CreateDateColumn()
  createdAt: Date;
}
