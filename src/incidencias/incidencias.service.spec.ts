import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { IncidenciasService } from './incidencias.service';
import { Incidencia } from './entities/incidencia.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EstadoIncidencia, Prioridad } from '../common/enums/prioridad.enum';

const TECH_A = 'tech-a';
const TECH_B = 'tech-b';
const INSTALACION = { nombre: 'Instalación Test' };

function mockInc(overrides: Partial<Incidencia> = {}): Incidencia {
  return {
    id: 'inc-1',
    titulo: 'Inversor caído',
    descripcion: 'El inversor no arranca',
    prioridad: Prioridad.ALTA,
    estado: EstadoIncidencia.ABIERTA,
    instalacion_id: 'inst-1',
    instalacion: INSTALACION as any,
    creado_por_id: 'user-1',
    creadoPor: {} as any,
    asignado_a_id: null as any,
    asignadoA: null as any,
    visita_id: null as any,
    resolucion: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Incidencia;
}

describe('IncidenciasService', () => {
  let service: IncidenciasService;
  let notifyUser: jest.Mock;

  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidenciasService,
        { provide: getRepositoryToken(Incidencia), useValue: repo },
        { provide: NotificationsGateway, useValue: { notifyUser: (notifyUser = jest.fn()) } },
      ],
    }).compile();

    service = module.get(IncidenciasService);
  });

  // ── create ──────────────────────────────────────────────────────────
  describe('create', () => {
    it('notifica al técnico cuando se crea con asignado_a_id', async () => {
      const inc = mockInc({ asignado_a_id: TECH_A });
      repo.create.mockReturnValue(inc);
      repo.save.mockResolvedValue(inc);
      repo.findOne.mockResolvedValue(inc);

      await service.create({ titulo: inc.titulo, descripcion: inc.descripcion, instalacion_id: inc.instalacion_id, asignado_a_id: TECH_A }, 'user-1');

      expect(notifyUser).toHaveBeenCalledWith(TECH_A, 'incidencia-asignada', expect.objectContaining({ incidenciaId: 'inc-1' }));
    });

    it('no notifica si no hay técnico asignado', async () => {
      const inc = mockInc();
      repo.create.mockReturnValue(inc);
      repo.save.mockResolvedValue(inc);
      repo.findOne.mockResolvedValue(inc);

      await service.create({ titulo: inc.titulo, descripcion: inc.descripcion, instalacion_id: inc.instalacion_id }, 'user-1');

      expect(notifyUser).not.toHaveBeenCalled();
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('lanza NotFoundException si no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });

    it('devuelve la incidencia si existe', async () => {
      const inc = mockInc();
      repo.findOne.mockResolvedValue(inc);
      expect(await service.findOne('inc-1')).toEqual(inc);
    });
  });

  // ── update ───────────────────────────────────────────────────────────
  describe('update', () => {
    it('notifica al técnico anterior y al nuevo cuando cambia asignado_a_id', async () => {
      const anterior  = mockInc({ asignado_a_id: TECH_A });
      const actualizado = mockInc({ asignado_a_id: TECH_B });
      repo.findOne.mockResolvedValueOnce(anterior).mockResolvedValueOnce(actualizado);
      repo.save.mockResolvedValue(actualizado);

      await service.update('inc-1', { asignado_a_id: TECH_B });

      expect(notifyUser).toHaveBeenCalledWith(TECH_A, 'incidencia-desasignada', expect.any(Object));
      expect(notifyUser).toHaveBeenCalledWith(TECH_B, 'incidencia-asignada', expect.any(Object));
    });

    it('no notifica cuando asignado_a_id no cambia', async () => {
      const inc = mockInc({ asignado_a_id: TECH_A });
      repo.findOne.mockResolvedValue(inc);
      repo.save.mockResolvedValue(inc);

      await service.update('inc-1', { estado: EstadoIncidencia.EN_PROGRESO });

      expect(notifyUser).not.toHaveBeenCalled();
    });

    it('no notifica al técnico anterior cuando no había asignado previo', async () => {
      const anterior   = mockInc({ asignado_a_id: null as any });
      const actualizado = mockInc({ asignado_a_id: TECH_B });
      repo.findOne.mockResolvedValueOnce(anterior).mockResolvedValueOnce(actualizado);
      repo.save.mockResolvedValue(actualizado);

      await service.update('inc-1', { asignado_a_id: TECH_B });

      expect(notifyUser).toHaveBeenCalledTimes(1);
      expect(notifyUser).toHaveBeenCalledWith(TECH_B, 'incidencia-asignada', expect.any(Object));
    });
  });

  // ── cerrar ───────────────────────────────────────────────────────────
  describe('cerrar', () => {
    it('cierra la incidencia con la resolución indicada', async () => {
      const inc = mockInc();
      repo.findOne.mockResolvedValue(inc);
      repo.save.mockResolvedValue(inc);

      await service.cerrar('inc-1', 'Se reemplazó el inversor');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoIncidencia.CERRADA,
          resolucion: 'Se reemplazó el inversor',
        }),
      );
    });
  });
});
