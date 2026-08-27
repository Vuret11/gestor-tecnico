'use client';
import { useEffect, useState } from 'react';
import { api, type Incidencia } from '@/lib/api';
import PageTable from '@/components/PageTable';

const PRIORIDAD_BADGE: Record<string, string> = {
  baja: 'bg-green-100 text-green-700',
  media: 'bg-yellow-100 text-yellow-700',
  alta: 'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700',
};

const ESTADO_BADGE: Record<string, string> = {
  abierta: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-yellow-100 text-yellow-700',
  cerrada: 'bg-gray-100 text-gray-600',
};

export default function IncidenciasPage() {
  const [rows, setRows] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.incidencias.list()
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTable
      title="Incidencias"
      subtitle="Gestión de incidencias y averías"
      loading={loading}
      error={error}
      rows={rows}
      columns={[
        { key: 'titulo', label: 'Título' },
        {
          key: 'prioridad',
          label: 'Prioridad',
          render: r => (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${PRIORIDAD_BADGE[r.prioridad] ?? 'bg-gray-100 text-gray-600'}`}>
              {r.prioridad}
            </span>
          ),
        },
        {
          key: 'estado',
          label: 'Estado',
          render: r => (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${ESTADO_BADGE[r.estado] ?? 'bg-gray-100 text-gray-600'}`}>
              {r.estado.replace('_', ' ')}
            </span>
          ),
        },
        { key: 'instalacion', label: 'Instalación', render: r => r.instalacion?.nombre ?? '—' },
        { key: 'asignadoA', label: 'Asignado a', render: r => r.asignadoA?.nombre ?? 'Sin asignar' },
        {
          key: 'createdAt',
          label: 'Fecha',
          render: r => new Date(r.createdAt).toLocaleDateString('es-ES'),
        },
      ]}
    />
  );
}
