import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { PlanProvincia } from './plan-provincia.entity';

export type TipoTecnico = 'propio' | 'externo' | 'subcontrata';

@Entity('plan_tecnicos')
export class PlanTecnico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // FK al usuario del sistema (nullable: permite técnicos externos sin cuenta)
  @Column({ nullable: true, unique: true })
  user_id: string;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  matricula: string;

  @Column({ type: 'varchar', default: 'propio' })
  tipo: TipoTecnico;

  @ManyToOne(() => PlanProvincia, { eager: true, nullable: true })
  @JoinColumn({ name: 'provincia_id' })
  provincia: PlanProvincia;

  @Column({ nullable: true })
  provincia_id: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ default: true })
  activo: boolean;

  @Column({ default: false })
  viaja: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
