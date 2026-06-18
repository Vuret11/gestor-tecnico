import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, OneToOne,
} from 'typeorm';
import { EstadoVisita } from '../../common/enums/estado-visita.enum';
import { TipoVisita } from '../../common/enums/tipo-visita.enum';
import { User } from '../../users/entities/user.entity';
import { Instalacion } from '../../instalaciones/entities/instalacion.entity';

@Entity('visitas')
export class Visita {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Instalacion, { eager: true })
  @JoinColumn({ name: 'instalacion_id' })
  instalacion: Instalacion;

  @Column()
  instalacion_id: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'tecnico_id' })
  tecnico: User;

  @Column()
  tecnico_id: string;

  @Column({ type: 'timestamp' })
  fechaProgramada: Date;

  @Column({ type: 'timestamp', nullable: true })
  fechaInicio: Date;

  @Column({ type: 'timestamp', nullable: true })
  fechaFin: Date;

  @Column({ type: 'varchar', default: TipoVisita.VISITA_TECNICA_FV })
  tipo: TipoVisita;

  @Column({ type: 'enum', enum: EstadoVisita, default: EstadoVisita.PROGRAMADA })
  estado: EstadoVisita;

  @Column({ type: 'text', nullable: true })
  notas: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
