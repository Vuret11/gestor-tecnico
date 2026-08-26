import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { VisitasService } from './visitas.service';
import { Visita } from './entities/visita.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EstadoVisita } from '../common/enums/estado-visita.enum';
import { TipoVisita } from '../common/enums/tipo-visita.enum';

const INSTALACION = { nombre: 'Instalación Test', direccion: 'Calle Test 1' };
const TECNICO_A   = { id: 'tech-a', nombre: 'Técnico A' };
const TECNICO_B   = { id: 'tech-b', nombre: 'Técnico B' };

function mockVisita(overrides: Partial<Visita> = {}): Visita {
  return {
    id: 'visita-1',
    tecnico_id: TECNICO_A.id,
    instalacion_id: 'inst-1',
    fechaProgramada: new Date('2026-09-01T10:00:00Z'),
    tipo: TipoVisita.VISITA_TECNICA_FV,
    estado: EstadoVisita.PROGRAMADA,
    instalacion: INSTALACION as any,
    tecnico: TECNICO_A as any,
    notas: null as any,
    fechaInicio: null as any,
    fechaFin: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Visita;
}

describe('VisitasService', () => {
  let service: VisitasService;
  let notifyUser: jest.Mock;

  // QueryBuilder stub reutilizable
  let qbGetOne: jest.Mock;
  const makeQb = () => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: (qbGetOne = jest.fn().mockResolvedValue(null)),
  });

  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.createQueryBuilder.mockReturnValue(makeQb());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitasService,
        { provide: getRepositoryToken(Visita), useValue: repo },
        {
          provide: NotificationsGateway,
          useValue: { notifyUser: (notifyUser = jest.fn()) },
        },
      ],
    }).compile();

    service = module.get(VisitasService);
  });

  // ── create ──────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      instalacion_id: 'inst-1',
      tecnico_id: TECNICO_A.id,
      fechaProgramada: '2026-09-01T10:00:00Z',
      tipo: TipoVisita.VISITA_TECNICA_FV,
    };

    it('crea la visita y notifica al técnico', async () => {
      const saved = mockVisita({ id: 'visita-new' });
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);
      repo.findOne.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(notifyUser).toHaveBeenCalledWith(
        TECNICO_A.id,
        'nueva-visita',
        expect.objectContaining({ visitaId: 'visita-new' }),
      );
      expect(result).toEqual(saved);
    });

    it('lanza ConflictException si el técnico tiene visita solapada', async () => {
      const qb = makeQb();
      qb.getOne.mockResolvedValue(mockVisita());
      repo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(notifyUser).not.toHaveBeenCalled();
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('lanza NotFoundException si la visita no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });

    it('devuelve la visita con relaciones', async () => {
      const v = mockVisita();
      repo.findOne.mockResolvedValue(v);
      expect(await service.findOne(v.id)).toEqual(v);
    });
  });

  // ── update ───────────────────────────────────────────────────────────
  describe('update', () => {
    it('notifica al técnico anterior y al nuevo cuando cambia tecnico_id', async () => {
      const anterior = mockVisita({ tecnico_id: TECNICO_A.id });
      const actualizado = mockVisita({ tecnico_id: TECNICO_B.id, tecnico: TECNICO_B as any });
      // findOne: primera llamada devuelve anterior, segunda el actualizado
      repo.findOne.mockResolvedValueOnce(anterior).mockResolvedValueOnce(actualizado);
      repo.save.mockResolvedValue(actualizado);

      await service.update('visita-1', { tecnico_id: TECNICO_B.id });

      expect(notifyUser).toHaveBeenCalledWith(TECNICO_A.id, 'visita-cancelada', expect.any(Object));
      expect(notifyUser).toHaveBeenCalledWith(TECNICO_B.id, 'nueva-visita', expect.any(Object));
    });

    it('notifica al mismo técnico cuando cambia fechaProgramada', async () => {
      const anterior = mockVisita();
      const nuevaFecha = '2026-09-02T10:00:00Z';
      const actualizado = mockVisita({ fechaProgramada: new Date(nuevaFecha) });
      repo.findOne.mockResolvedValueOnce(anterior).mockResolvedValueOnce(actualizado);
      repo.save.mockResolvedValue(actualizado);

      await service.update('visita-1', { fechaProgramada: nuevaFecha });

      expect(notifyUser).toHaveBeenCalledTimes(1);
      expect(notifyUser).toHaveBeenCalledWith(TECNICO_A.id, 'visita-actualizada', expect.any(Object));
    });

    it('no notifica cuando solo cambia el estado', async () => {
      const v = mockVisita();
      repo.findOne.mockResolvedValue(v);
      repo.save.mockResolvedValue(v);

      await service.update('visita-1', { estado: EstadoVisita.EN_CURSO });

      expect(notifyUser).not.toHaveBeenCalled();
    });
  });

  // ── remove ───────────────────────────────────────────────────────────
  describe('remove', () => {
    it('cancela la visita y notifica al técnico', async () => {
      const v = mockVisita();
      repo.findOne.mockResolvedValue(v);
      repo.save.mockResolvedValue({ ...v, estado: EstadoVisita.CANCELADA });

      await service.remove('visita-1');

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ estado: EstadoVisita.CANCELADA }));
      expect(notifyUser).toHaveBeenCalledWith(TECNICO_A.id, 'visita-cancelada', expect.any(Object));
    });
  });

  // ── checkin / checkout ───────────────────────────────────────────────
  describe('checkin / checkout', () => {
    it('checkin cambia estado a EN_CURSO', async () => {
      const v = mockVisita();
      repo.findOne.mockResolvedValue(v);
      repo.save.mockResolvedValue(v);

      await service.checkin('visita-1');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoVisita.EN_CURSO }),
      );
    });

    it('checkout cambia estado a COMPLETADA', async () => {
      const v = mockVisita();
      repo.findOne.mockResolvedValue(v);
      repo.save.mockResolvedValue(v);

      await service.checkout('visita-1');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoVisita.COMPLETADA }),
      );
    });
  });
});
