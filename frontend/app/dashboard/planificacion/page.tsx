'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, type PlanTecnico, type PlanObra, type PlanProvincia, type PlanAsignacion, type EstadoEspecial } from '@/lib/api';

// ── Utilidades de fecha ───────────────────────────────────────────────────────
function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const DIAS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Colores estado especial ───────────────────────────────────────────────────
const ESTADO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  vacaciones:      { bg: 'bg-sky-100',    text: 'text-sky-700',    label: 'VAC' },
  baja:            { bg: 'bg-red-100',    text: 'text-red-700',    label: 'BAJA' },
  comp_horas:      { bg: 'bg-purple-100', text: 'text-purple-700', label: 'COMP' },
  libre:           { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'LIBRE' },
  fiesta_nacional: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'FIESTA' },
  medico:          { bg: 'bg-orange-100', text: 'text-orange-700', label: 'MED' },
  sancion:         { bg: 'bg-red-200',    text: 'text-red-800',    label: 'SANC' },
  reconocimiento:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'RECON' },
  otros:           { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'OTRO' },
};

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TabKey = 'semana' | 'obras' | 'tecnicos' | 'maestros';

interface CellModal {
  tecnico: PlanTecnico;
  fecha: string;
  asignacion?: PlanAsignacion;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PlanificacionPage() {
  const [tab, setTab] = useState<TabKey>('semana');

  // Datos maestros
  const [provincias, setProvincias] = useState<PlanProvincia[]>([]);
  const [tecnicos, setTecnicos] = useState<PlanTecnico[]>([]);
  const [obras, setObras] = useState<PlanObra[]>([]);

  // Filtros
  const [provinciaFiltro, setProvinciaFiltro] = useState('');

  // Semana
  const [monday, setMonday] = useState<Date>(() => startOfWeek(new Date()));
  const [asignaciones, setAsignaciones] = useState<PlanAsignacion[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // Modal de celda
  const [cellModal, setCellModal] = useState<CellModal | null>(null);
  const [saving, setSaving] = useState(false);
  const [cellError, setCellError] = useState('');

  // Form estado de asignación en el modal
  const [formObraId, setFormObraId] = useState('');
  const [formProvinciaId, setFormProvinciaId] = useState('');
  const [formEstado, setFormEstado] = useState<EstadoEspecial | ''>('');
  const [formViaja, setFormViaja] = useState(false);
  const [formObs, setFormObs] = useState('');

  // Modal maestros
  const [modalMaestro, setModalMaestro] = useState<'tecnico' | 'obra' | 'provincia' | null>(null);
  const [maestroForm, setMaestroForm] = useState<Record<string, string>>({});
  const [maestroError, setMaestroError] = useState('');
  const [savingMaestro, setSavingMaestro] = useState(false);

  const days = weekDays(monday);
  const desde = isoDate(days[0]);
  const hasta = isoDate(days[6]);

  // ── Carga datos maestros ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.planificacion.getProvincias(),
      api.planificacion.getTecnicos(),
      api.planificacion.getObras(),
    ]).then(([p, t, o]) => {
      setProvincias(p);
      setTecnicos(t);
      setObras(o);
    });
  }, []);

  // ── Carga asignaciones de la semana ────────────────────────────────────────
  const loadSemana = useCallback(async () => {
    setLoadingGrid(true);
    try {
      const data = await api.planificacion.getAsignacionesSemana(desde, hasta, provinciaFiltro || undefined);
      setAsignaciones(data);
    } finally {
      setLoadingGrid(false);
    }
  }, [desde, hasta, provinciaFiltro]);

  useEffect(() => {
    if (tab === 'semana') loadSemana();
  }, [tab, loadSemana]);

  // ── Navegación de semana ────────────────────────────────────────────────────
  function prevWeek() { setMonday(m => addDays(m, -7)); }
  function nextWeek() { setMonday(m => addDays(m, 7)); }
  function goToday()  { setMonday(startOfWeek(new Date())); }

  // ── Lookup asignación por técnico + fecha ───────────────────────────────────
  function getAsig(tecnicoId: string, fecha: string): PlanAsignacion | undefined {
    return asignaciones.find(a => a.tecnico_id === tecnicoId && a.fecha === fecha);
  }

  // ── Abrir modal de celda ────────────────────────────────────────────────────
  function openCell(tecnico: PlanTecnico, fecha: string) {
    const asig = getAsig(tecnico.id, fecha);
    setCellModal({ tecnico, fecha, asignacion: asig });
    setFormObraId(asig?.obra_id ?? '');
    setFormProvinciaId(asig?.provincia_trabajo_id ?? '');
    setFormEstado((asig?.estadoEspecial as EstadoEspecial) ?? '');
    setFormViaja(asig?.viaja ?? false);
    setFormObs(asig?.observaciones ?? '');
    setCellError('');
  }

  function closeCell() {
    setCellModal(null);
    setCellError('');
  }

  // ── Guardar asignación ──────────────────────────────────────────────────────
  async function saveCell() {
    if (!cellModal) return;
    setSaving(true);
    setCellError('');
    try {
      const dto = {
        tecnico_id: cellModal.tecnico.id,
        fecha: cellModal.fecha,
        obra_id: formObraId || undefined,
        provincia_trabajo_id: formProvinciaId || undefined,
        estadoEspecial: formEstado || undefined,
        viaja: formViaja,
        observaciones: formObs || undefined,
      };

      if (cellModal.asignacion) {
        await api.planificacion.updateAsignacion(cellModal.asignacion.id, dto);
      } else {
        await api.planificacion.createAsignacion(dto);
      }
      await loadSemana();
      closeCell();
    } catch (e: any) {
      setCellError(e.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // ── Borrar asignación ───────────────────────────────────────────────────────
  async function deleteCell() {
    if (!cellModal?.asignacion) return;
    if (!confirm('¿Eliminar esta asignación?')) return;
    setSaving(true);
    try {
      await api.planificacion.deleteAsignacion(cellModal.asignacion.id);
      await loadSemana();
      closeCell();
    } catch (e: any) {
      setCellError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Celda visual ────────────────────────────────────────────────────────────
  function CellContent({ asig }: { asig?: PlanAsignacion }) {
    if (!asig) return <span className="text-gray-300 text-xs">—</span>;

    if (asig.estadoEspecial) {
      const s = ESTADO_STYLE[asig.estadoEspecial] ?? ESTADO_STYLE.otros;
      return (
        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${s.bg} ${s.text}`}>
          {s.label}
        </span>
      );
    }

    const obraLabel = asig.obra
      ? `${asig.obra.numeroObra} · ${asig.obra.nombre}`
      : asig.observaciones ?? '?';

    const provColor = asig.provinciatrabajo?.color;

    return (
      <div className="flex flex-col gap-0.5">
        {provColor && (
          <div className="w-full h-1 rounded-full" style={{ backgroundColor: provColor }} />
        )}
        <span className="text-xs text-gray-700 leading-tight line-clamp-2">
          {obraLabel}
        </span>
        {asig.viaja && <span className="text-xs text-blue-500">✈ Viaja</span>}
      </div>
    );
  }

  // ── Guardar maestro ─────────────────────────────────────────────────────────
  async function saveMaestro() {
    setSavingMaestro(true);
    setMaestroError('');
    try {
      if (modalMaestro === 'tecnico') {
        const t = await api.planificacion.createTecnico({
          nombre: maestroForm.nombre,
          matricula: maestroForm.matricula,
          tipo: (maestroForm.tipo as any) || 'propio',
          provincia_id: maestroForm.provincia_id || undefined,
          telefono: maestroForm.telefono,
          viaja: maestroForm.viaja === 'true',
        });
        setTecnicos(prev => [...prev, t]);
      } else if (modalMaestro === 'obra') {
        const o = await api.planificacion.createObra({
          numeroObra: maestroForm.numeroObra,
          nombre: maestroForm.nombre,
          cliente_id: maestroForm.cliente_id || undefined,
          provincia_id: maestroForm.provincia_id || undefined,
          tipoTrabajo: (maestroForm.tipoTrabajo as any) || 'otro',
          estado: 'pendiente',
          fechaPrevista: maestroForm.fechaPrevista || undefined,
          ciudad: maestroForm.ciudad,
          direccion: maestroForm.direccion,
        });
        setObras(prev => [...prev, o]);
      } else if (modalMaestro === 'provincia') {
        const p = await api.planificacion.createProvincia({
          nombre: maestroForm.nombre,
          color: maestroForm.color || '#6366f1',
          activo: true,
        });
        setProvincias(prev => [...prev, p]);
      }
      setModalMaestro(null);
      setMaestroForm({});
    } catch (e: any) {
      setMaestroError(e.message);
    } finally {
      setSavingMaestro(false);
    }
  }

  // ── Filtro de técnicos por provincia ───────────────────────────────────────
  const tecnicosFiltrados = provinciaFiltro
    ? tecnicos.filter(t => t.provincia_id === provinciaFiltro || !t.provincia_id)
    : tecnicos;

  // ── Render tabs ─────────────────────────────────────────────────────────────
  const TABS: { key: TabKey; label: string }[] = [
    { key: 'semana', label: 'Semana' },
    { key: 'obras',  label: 'Obras' },
    { key: 'tecnicos', label: 'Técnicos' },
    { key: 'maestros', label: 'Maestros' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planificación</h1>
          <p className="text-gray-500 text-sm mt-0.5">Asignación de técnicos a obras</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setModalMaestro('tecnico'); setMaestroForm({}); }}
            className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition"
          >
            + Técnico
          </button>
          <button
            onClick={() => { setModalMaestro('obra'); setMaestroForm({}); }}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            + Obra
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              tab === t.key
                ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Semana ────────────────────────────────────────────────────── */}
      {tab === 'semana' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Controles */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button onClick={prevWeek} className="px-2 py-1 border rounded hover:bg-gray-50 text-gray-600">‹</button>
              <button onClick={goToday} className="px-3 py-1 border rounded text-sm hover:bg-gray-50 text-gray-600">Hoy</button>
              <button onClick={nextWeek} className="px-2 py-1 border rounded hover:bg-gray-50 text-gray-600">›</button>
            </div>
            <span className="font-semibold text-gray-800">
              {days[0].getDate()} {MESES_ES[days[0].getMonth()]} – {days[6].getDate()} {MESES_ES[days[6].getMonth()]} {days[0].getFullYear()}
            </span>
            <select
              value={provinciaFiltro}
              onChange={e => setProvinciaFiltro(e.target.value)}
              className="ml-auto border rounded px-2 py-1 text-sm text-gray-600"
            >
              <option value="">Todas las provincias</option>
              {provincias.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* Grid */}
          {loadingGrid ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">Cargando...</div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 border border-gray-200 text-left text-xs font-semibold text-gray-500 min-w-[140px]">
                      Técnico
                    </th>
                    {days.map((d, i) => {
                      const isToday = isoDate(d) === isoDate(new Date());
                      return (
                        <th
                          key={i}
                          className={`px-2 py-2 border border-gray-200 text-center text-xs font-semibold min-w-[110px] ${
                            isToday ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'
                          }`}
                        >
                          <div>{DIAS_ES[i]}</div>
                          <div className={`text-sm font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                            {d.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tecnicosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                        No hay técnicos. Añade técnicos desde el botón + Técnico.
                      </td>
                    </tr>
                  )}
                  {tecnicosFiltrados.map(tecnico => (
                    <tr key={tecnico.id} className="group">
                      <td className="sticky left-0 bg-white z-10 px-3 py-2 border border-gray-200 font-medium text-gray-700 group-hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold flex-shrink-0">
                            {tecnico.nombre[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold">{tecnico.nombre}</div>
                            {tecnico.provincia && (
                              <div className="text-xs text-gray-400 truncate">{tecnico.provincia.nombre}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      {days.map((d, i) => {
                        const fecha = isoDate(d);
                        const asig = getAsig(tecnico.id, fecha);
                        const isWeekend = i >= 5;
                        return (
                          <td
                            key={i}
                            onClick={() => openCell(tecnico, fecha)}
                            className={`border border-gray-200 px-2 py-1.5 align-top cursor-pointer hover:bg-blue-50 transition min-h-[60px] ${
                              isWeekend ? 'bg-gray-50/50' : 'bg-white'
                            } ${asig ? 'hover:ring-1 hover:ring-blue-300' : ''}`}
                          >
                            <CellContent asig={asig} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Obras ─────────────────────────────────────────────────────── */}
      {tab === 'obras' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">{obras.length} obras</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['Nº Obra', 'Nombre', 'Cliente', 'Provincia', 'Tipo', 'Estado', 'Fecha Prevista'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {obras.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sin obras</td></tr>
                )}
                {obras.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-700">{o.numeroObra}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{o.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{o.cliente?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{o.provincia?.nombre ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 capitalize">
                        {o.tipoTrabajo.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoObraTag estado={o.estado} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{o.fechaPrevista ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Técnicos ──────────────────────────────────────────────────── */}
      {tab === 'tecnicos' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <span className="text-sm text-gray-500">{tecnicos.length} técnicos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['Nombre', 'Matrícula', 'Tipo', 'Provincia', 'Teléfono', 'Viaja'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tecnicos.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin técnicos</td></tr>
                )}
                {tecnicos.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{t.nombre}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{t.matricula ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs capitalize ${
                        t.tipo === 'propio' ? 'bg-green-50 text-green-700' :
                        t.tipo === 'externo' ? 'bg-orange-50 text-orange-700' :
                        'bg-purple-50 text-purple-700'
                      }`}>{t.tipo}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.provincia?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{t.telefono ?? '—'}</td>
                    <td className="px-4 py-3">{t.viaja ? '✈ Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Maestros ──────────────────────────────────────────────────── */}
      {tab === 'maestros' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Provincias</h2>
              <button
                onClick={() => { setModalMaestro('provincia'); setMaestroForm({ color: '#6366f1' }); }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                + Añadir
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {provincias.map(p => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.nombre}
                </div>
              ))}
              {provincias.length === 0 && <span className="text-gray-400 text-sm">Sin provincias</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Asignación de celda ─────────────────────────────────────── */}
      {cellModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeCell}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">{cellModal.tecnico.nombre}</h2>
                <p className="text-sm text-gray-500">{cellModal.fecha}</p>
              </div>
              <button onClick={closeCell} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              {/* Estado especial */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado especial</label>
                <select
                  value={formEstado}
                  onChange={e => { setFormEstado(e.target.value as EstadoEspecial | ''); if (e.target.value) setFormObraId(''); }}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Ninguno (asignar obra) —</option>
                  {Object.entries(ESTADO_STYLE).map(([k, v]) => (
                    <option key={k} value={k}>{v.label} — {k.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              {/* Obra (solo si no hay estado especial) */}
              {!formEstado && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Obra</label>
                  <select
                    value={formObraId}
                    onChange={e => setFormObraId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— Sin obra —</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>{o.numeroObra} · {o.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Provincia de trabajo */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Provincia de trabajo</label>
                <select
                  value={formProvinciaId}
                  onChange={e => setFormProvinciaId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Sin especificar —</option>
                  {provincias.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Viaja */}
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formViaja}
                  onChange={e => setFormViaja(e.target.checked)}
                  className="rounded"
                />
                Viaja desplazado
              </label>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
                <textarea
                  value={formObs}
                  onChange={e => setFormObs(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Notas adicionales..."
                />
              </div>

              {cellError && <p className="text-red-500 text-sm">{cellError}</p>}
            </div>

            <div className="flex gap-2 mt-5">
              {cellModal.asignacion && (
                <button
                  onClick={deleteCell}
                  disabled={saving}
                  className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
                >
                  Borrar
                </button>
              )}
              <button
                onClick={closeCell}
                className="ml-auto px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveCell}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : (cellModal.asignacion ? 'Actualizar' : 'Asignar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nuevo técnico / obra / provincia ────────────────────────── */}
      {modalMaestro && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModalMaestro(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                {modalMaestro === 'tecnico' ? 'Nuevo técnico' : modalMaestro === 'obra' ? 'Nueva obra' : 'Nueva provincia'}
              </h2>
              <button onClick={() => setModalMaestro(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="space-y-3">
              {/* Formulario Técnico */}
              {modalMaestro === 'tecnico' && (
                <>
                  <FormField label="Nombre *" value={maestroForm.nombre ?? ''} onChange={v => setMaestroForm(f => ({ ...f, nombre: v }))} />
                  <FormField label="Matrícula" value={maestroForm.matricula ?? ''} onChange={v => setMaestroForm(f => ({ ...f, matricula: v }))} />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                    <select
                      value={maestroForm.tipo ?? 'propio'}
                      onChange={e => setMaestroForm(f => ({ ...f, tipo: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="propio">Propio</option>
                      <option value="externo">Externo</option>
                      <option value="subcontrata">Subcontrata</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Provincia base</label>
                    <select
                      value={maestroForm.provincia_id ?? ''}
                      onChange={e => setMaestroForm(f => ({ ...f, provincia_id: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">— Sin provincia —</option>
                      {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <FormField label="Teléfono" value={maestroForm.telefono ?? ''} onChange={v => setMaestroForm(f => ({ ...f, telefono: v }))} />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={maestroForm.viaja === 'true'} onChange={e => setMaestroForm(f => ({ ...f, viaja: String(e.target.checked) }))} />
                    Puede viajar
                  </label>
                </>
              )}

              {/* Formulario Obra */}
              {modalMaestro === 'obra' && (
                <>
                  <FormField label="Nº Obra *" value={maestroForm.numeroObra ?? ''} onChange={v => setMaestroForm(f => ({ ...f, numeroObra: v }))} />
                  <FormField label="Nombre *" value={maestroForm.nombre ?? ''} onChange={v => setMaestroForm(f => ({ ...f, nombre: v }))} />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de trabajo</label>
                    <select
                      value={maestroForm.tipoTrabajo ?? 'otro'}
                      onChange={e => setMaestroForm(f => ({ ...f, tipoTrabajo: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="instalacion_fv">Instalación FV</option>
                      <option value="instalacion_aerotermia">Instalación Aerotermia</option>
                      <option value="mantenimiento">Mantenimiento</option>
                      <option value="incidencia">Incidencia</option>
                      <option value="visita_tecnica">Visita técnica</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Provincia</label>
                    <select
                      value={maestroForm.provincia_id ?? ''}
                      onChange={e => setMaestroForm(f => ({ ...f, provincia_id: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">— Sin especificar —</option>
                      {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <FormField label="Ciudad" value={maestroForm.ciudad ?? ''} onChange={v => setMaestroForm(f => ({ ...f, ciudad: v }))} />
                  <FormField label="Fecha prevista" type="date" value={maestroForm.fechaPrevista ?? ''} onChange={v => setMaestroForm(f => ({ ...f, fechaPrevista: v }))} />
                </>
              )}

              {/* Formulario Provincia */}
              {modalMaestro === 'provincia' && (
                <>
                  <FormField label="Nombre *" value={maestroForm.nombre ?? ''} onChange={v => setMaestroForm(f => ({ ...f, nombre: v }))} />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={maestroForm.color ?? '#6366f1'}
                        onChange={e => setMaestroForm(f => ({ ...f, color: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer border"
                      />
                      <span className="text-sm text-gray-500">{maestroForm.color ?? '#6366f1'}</span>
                    </div>
                  </div>
                </>
              )}

              {maestroError && <p className="text-red-500 text-sm">{maestroError}</p>}
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setModalMaestro(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={saveMaestro}
                disabled={savingMaestro}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {savingMaestro ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function FormField({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}

function EstadoObraTag({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    pendiente:    'bg-gray-100 text-gray-600',
    planificada:  'bg-blue-100 text-blue-700',
    confirmada:   'bg-indigo-100 text-indigo-700',
    en_curso:     'bg-yellow-100 text-yellow-700',
    realizada:    'bg-green-100 text-green-700',
    cancelada:    'bg-red-100 text-red-600',
    reprogramada: 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs capitalize ${styles[estado] ?? 'bg-gray-100 text-gray-600'}`}>
      {estado.replace(/_/g, ' ')}
    </span>
  );
}
