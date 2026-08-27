'use client';
import { useEffect, useState } from 'react';
import { api, type Visita } from '@/lib/api';
import PageTable from '@/components/PageTable';

const ESTADO_BADGE: Record<string, string> = {
  programada: 'bg-blue-100 text-blue-700',
  en_curso: 'bg-yellow-100 text-yellow-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-600',
};

const TIPO_LABELS: Record<string, string> = {
  visita_tecnica_fv: 'Visita FV',
  visita_tecnica_aerotermia: 'Visita Aerotermia',
  instalacion_nueva_fv: 'Instalación FV',
  instalacion_nueva_aerotermia: 'Instalación Aerotermia',
};

export default function VisitasPage() {
  const [rows, setRows] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.visitas.list()
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTable
      title="Visitas"
      subtitle="Todas las visitas programadas"
      loading={loading}
      error={error}
      rows={rows}
      columns={[
        {
          key: 'fechaProgramada',
          label: 'Fecha',
          render: r => new Date(r.fechaProgramada).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
        },
        {
          key: 'tipo',
          label: 'Tipo',
          render: r => TIPO_LABELS[r.tipo] ?? r.tipo,
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
        {
          key: 'tecnico',
          label: 'Técnico',
          render: r => r.tecnico?.nombre ?? '—',
        },
        {
          key: 'instalacion',
          label: 'Instalación',
          render: r => r.instalacion?.nombre ?? '—',
        },
      ]}
    />
  );
}
