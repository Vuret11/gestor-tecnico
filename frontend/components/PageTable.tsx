'use client';

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  title: string;
  subtitle?: string;
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  error?: string;
}

export default function PageTable<T extends { id: string }>({
  title, subtitle, columns, rows, loading, error,
}: Props<T>) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-48 text-gray-400">Cargando...</div>
        )}
        {error && (
          <div className="flex items-center justify-center h-48 text-red-500">{error}</div>
        )}
        {!loading && !error && (
          <>
            <div className="px-6 py-4 border-b border-gray-100">
              <span className="text-sm text-gray-500">{rows.length} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {columns.map(c => (
                      <th key={String(c.key)} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400">
                        Sin registros
                      </td>
                    </tr>
                  )}
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50 transition">
                      {columns.map(c => (
                        <td key={String(c.key)} className="px-6 py-4 text-gray-700">
                          {c.render ? c.render(row) : String((row as Record<string, unknown>)[String(c.key)] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
