'use client';
import { useEffect, useState } from 'react';
import { api, type Instalacion } from '@/lib/api';
import PageTable from '@/components/PageTable';

export default function InstalacionesPage() {
  const [rows, setRows] = useState<Instalacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.instalaciones.list()
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTable
      title="Instalaciones"
      subtitle="Instalaciones registradas"
      loading={loading}
      error={error}
      rows={rows}
      columns={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'direccion', label: 'Dirección' },
        { key: 'ciudad', label: 'Ciudad' },
        { key: 'cliente', label: 'Cliente', render: r => r.cliente ?? '—' },
        {
          key: 'activa',
          label: 'Estado',
          render: r => (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${r.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {r.activa ? 'Activa' : 'Inactiva'}
            </span>
          ),
        },
      ]}
    />
  );
}
