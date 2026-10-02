import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Catalogo de maquinas, copiado del CRM (Ingeniero backend -> GET /maquinas).
// id_externo guarda el id del CRM para que los documentos salgan identicos.
@Entity('maquinas_catalogo')
export class Maquina {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true, unique: true })
  id_externo: number;

  @Column({ nullable: true })
  fabricante: string;

  @Column({ nullable: true })
  gama: string;

  @Column({ nullable: true })
  modelo: string;

  @Column({ nullable: true })
  codigo_fabricante: string;

  @Column({ nullable: true })
  tipo_uso: string;

  @Column({ nullable: true })
  refrigerante: string;

  @Column({ type: 'float', nullable: true })
  potencia_calorifica_kw: number;

  @Column({ type: 'float', nullable: true })
  potencia_frigorifica_kw: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
