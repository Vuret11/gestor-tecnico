'use client';
import { useEffect, useState } from 'react';
import { api, type Cliente } from '@/lib/api';
import PageTable from '@/components/PageTable';

export default function ClientesPage() {
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.clientes.list()
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTable
      title="Clientes"
      subtitle="Listado de clientes"
      loading={loading}
      error={error}
      rows={rows}
      columns={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'email', label: 'Email', render: r => r.email ?? '—' },
        { key: 'telefono', label: 'Teléfono', render: r => r.telefono ?? '—' },
        { key: 'direccion', label: 'Dirección', render: r => r.direccion ?? '—' },
      ]}
    />
  );
}
