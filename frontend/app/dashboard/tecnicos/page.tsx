'use client';
import { useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';
import PageTable from '@/components/PageTable';

export default function TecnicosPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.tecnicos.list()
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTable
      title="Técnicos"
      subtitle="Usuarios y técnicos del sistema"
      loading={loading}
      error={error}
      rows={rows}
      columns={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'email', label: 'Email' },
        {
          key: 'rol',
          label: 'Rol',
          render: r => (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
              r.rol === 'admin' ? 'bg-purple-100 text-purple-700' :
              r.rol === 'oficina' ? 'bg-blue-100 text-blue-700' :
              'bg-green-100 text-green-700'
            }`}>
              {r.rol}
            </span>
          ),
        },
        { key: 'telefono', label: 'Teléfono', render: r => r.telefono ?? '—' },
        {
          key: 'activo',
          label: 'Estado',
          render: r => (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${r.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {r.activo ? 'Activo' : 'Inactivo'}
            </span>
          ),
        },
      ]}
    />
  );
}
