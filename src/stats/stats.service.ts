import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Visita } from '../visitas/entities/visita.entity';
import { Incidencia } from '../incidencias/entities/incidencia.entity';
import { User } from '../users/entities/user.entity';
import { Instalacion } from '../instalaciones/entities/instalacion.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { EstadoVisita } from '../common/enums/estado-visita.enum';
import { EstadoIncidencia, Prioridad } from '../common/enums/prioridad.enum';
import { Rol } from '../common/enums/rol.enum';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Visita) private visitasRepo: Repository<Visita>,
    @InjectRepository(Incidencia) private incidenciasRepo: Repository<Incidencia>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Instalacion) private instalacionesRepo: Repository<Instalacion>,
    @InjectRepository(Cliente) private clientesRepo: Repository<Cliente>,
  ) {}

  async getDashboard() {
    const ahora = new Date();
    const inicioHoy = new Date(ahora); inicioHoy.setHours(0, 0, 0, 0);
    const finHoy = new Date(ahora); finHoy.setHours(23, 59, 59, 999);

    const diaSemana = ahora.getDay(); // 0=dom, 1=lun...
    const diffLunes = (diaSemana === 0 ? -6 : 1 - diaSemana);
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() + diffLunes);
    inicioSemana.setHours(0, 0, 0, 0);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    finSemana.setHours(23, 59, 59, 999);

    const [
      visitasHoy,
      visitasSemana,
      visitasPorEstadoRaw,
      incidenciasAbiertas,
      incidenciasPorPrioridadRaw,
      tecnicosActivos,
      instalacionesActivas,
      totalClientes,
    ] = await Promise.all([
      this.visitasRepo.count({
        where: [
          { fechaProgramada: Between(inicioHoy, finHoy), estado: EstadoVisita.PROGRAMADA },
          { fechaProgramada: Between(inicioHoy, finHoy), estado: EstadoVisita.EN_CURSO },
          { fechaProgramada: Between(inicioHoy, finHoy), estado: EstadoVisita.COMPLETADA },
        ],
      }),
      this.visitasRepo.count({
        where: [
          { fechaProgramada: Between(inicioSemana, finSemana), estado: EstadoVisita.PROGRAMADA },
          { fechaProgramada: Between(inicioSemana, finSemana), estado: EstadoVisita.EN_CURSO },
          { fechaProgramada: Between(inicioSemana, finSemana), estado: EstadoVisita.COMPLETADA },
        ],
      }),
      this.visitasRepo
        .createQueryBuilder('v')
        .select('v.estado', 'estado')
        .addSelect('COUNT(v.id)', 'total')
        .groupBy('v.estado')
        .getRawMany<{ estado: string; total: string }>(),
      this.incidenciasRepo.count({
        where: [
          { estado: EstadoIncidencia.ABIERTA },
          { estado: EstadoIncidencia.EN_PROGRESO },
        ],
      }),
      this.incidenciasRepo
        .createQueryBuilder('i')
        .select('i.prioridad', 'prioridad')
        .addSelect('COUNT(i.id)', 'total')
        .where('i.estado IN (:...estados)', { estados: [EstadoIncidencia.ABIERTA, EstadoIncidencia.EN_PROGRESO] })
        .groupBy('i.prioridad')
        .getRawMany<{ prioridad: string; total: string }>(),
      this.usersRepo.count({ where: { rol: Rol.TECNICO, activo: true } }),
      this.instalacionesRepo.count({ where: { activo: true } }),
      this.clientesRepo.count({ where: { activo: true } }),
    ]);

    return {
      visitasHoy,
      visitasSemana,
      visitasPorEstado: this.groupToMap(visitasPorEstadoRaw, 'estado', Object.values(EstadoVisita)),
      incidenciasAbiertas,
      incidenciasPorPrioridad: this.groupToMap(incidenciasPorPrioridadRaw, 'prioridad', Object.values(Prioridad)),
      tecnicosActivos,
      instalacionesActivas,
      totalClientes,
    };
  }

  async getKpisTecnicos(desde?: Date, hasta?: Date) {
    const tecnicos = await this.usersRepo.find({
      where: { rol: Rol.TECNICO, activo: true },
      order: { nombre: 'ASC' },
    });

    const whereTime = desde && hasta ? { fechaProgramada: Between(desde, hasta) } : {};

    const [todasVisitas, todasIncidencias] = await Promise.all([
      this.visitasRepo.find({ where: whereTime, relations: { instalacion: true, tecnico: true } }),
      this.incidenciasRepo.find({ relations: { creadoPor: true } }),
    ]);

    return tecnicos.map(t => {
      const visitas = todasVisitas.filter(v => v.tecnico_id === t.id);
      const completadas = visitas.filter(v => v.estado === EstadoVisita.COMPLETADA);
      const incidencias = todasIncidencias.filter(i => i.creadoPor?.id === t.id);

      // Horas trabajadas: suma de (fechaFin - fechaInicio) de visitas completadas
      let minutosTotales = 0;
      for (const v of completadas) {
        if (v.fechaInicio && v.fechaFin) {
          minutosTotales += (new Date(v.fechaFin).getTime() - new Date(v.fechaInicio).getTime()) / 60000;
        }
      }
      const horasTotales = Math.round(minutosTotales / 60 * 10) / 10;

      // Instalaciones únicas visitadas
      const instalacionesSet = new Set(visitas.map(v => v.instalacion_id));

      return {
        tecnico: { id: t.id, nombre: t.nombre, email: t.email },
        visitas: { total: visitas.length, completadas: completadas.length },
        horas: horasTotales,
        incidencias: incidencias.length,
        instalaciones: instalacionesSet.size,
      };
    });
  }

  private groupToMap(rows: { [key: string]: string }[], key: string, allKeys: string[]): Record<string, number> {
    const base = Object.fromEntries(allKeys.map(k => [k, 0]));
    for (const row of rows) {
      base[row[key]] = parseInt(row.total, 10);
    }
    return base;
  }
}
