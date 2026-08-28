import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RepoCarpeta } from './repo-carpeta.entity';
import { User } from '../../users/entities/user.entity';

@Entity('repo_archivos')
export class RepoArchivo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  carpeta_id: string;

  @ManyToOne(() => RepoCarpeta, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'carpeta_id' })
  carpeta: RepoCarpeta;

  @Column()
  nombre: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  tipo?: string;

  @Column({ nullable: true, type: 'bigint' })
  tamaño?: number;

  @Column({ nullable: true })
  subidoPor_id?: string;

  @ManyToOne(() => User, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subidoPor_id' })
  subidoPor?: User;

  @CreateDateColumn()
  createdAt: Date;
}
