import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Rol } from '../../common/enums/rol.enum';

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ type: 'enum', enum: Rol, default: Rol.TECNICO })
  rol: Rol;

  @Column({ default: true })
  activo: boolean;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  departamento: string;

  @Column({ type: 'json', nullable: true, default: null })
  modulosAcceso: string[] | null;

  @Column({ nullable: true })
  expoPushToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
