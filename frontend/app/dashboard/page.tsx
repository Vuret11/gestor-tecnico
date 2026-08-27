'use client';
import { useEffect, useState } from 'react';
import { api, type Dashboard } from '@/lib/api';

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  icon: string;
}

function StatCard({ label, value, color, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-2xl`}>
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

interface BarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function Bar({ label, value, total, color }: BarProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-28 shrink-0 capitalize">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-6 text-right">{value}</span>
    </div>
  );
}

const ESTADO_COLORS: Record<string, string> = {
  programada: 'bg-blue-500',
  en_curso: 'bg-yellow-500',
  completada: 'bg-green-500',
  cancelada: 'bg-red-400',
};

const PRIORIDAD_COLORS: Record<string, string> = {
  baja: 'bg-green-400',
  media: 'bg-yellow-400',
  alta: 'bg-orange-500',
  critica: 'bg-red-600',
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>;

  const totalVisitas = Object.values(data.visitasPorEstado).reduce((a, b) => a + b, 0);
  const totalIncidencias = Object.values(data.incidenciasPorPrioridad).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen general del sistema</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Visitas hoy" value={data.visitasHoy} color="bg-blue-50" icon="📅" />
        <StatCard label="Esta semana" value={data.visitasSemana} color="bg-indigo-50" icon="🗓️" />
        <StatCard label="Incidencias abiertas" value={data.incidenciasAbiertas} color="bg-red-50" icon="⚠️" />
        <StatCard label="Técnicos activos" value={data.tecnicosActivos} color="bg-green-50" icon="🔧" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <StatCard label="Instalaciones activas" value={data.instalacionesActivas} color="bg-purple-50" icon="🏠" />
        <StatCard label="Total clientes" value={data.totalClientes} color="bg-yellow-50" icon="👥" />
        <StatCard label="Total visitas" value={totalVisitas} color="bg-gray-50" icon="📊" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Visitas por estado */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Visitas por estado</h2>
          <div className="space-y-3">
            {Object.entries(data.visitasPorEstado).map(([estado, count]) => (
              <Bar
                key={estado}
                label={estado.replace('_', ' ')}
                value={count}
                total={totalVisitas}
                color={ESTADO_COLORS[estado] ?? 'bg-gray-400'}
              />
            ))}
          </div>
        </div>

        {/* Incidencias por prioridad */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Incidencias por prioridad</h2>
          <div className="space-y-3">
            {Object.entries(data.incidenciasPorPrioridad).map(([prio, count]) => (
              <Bar
                key={prio}
                label={prio}
                value={count}
                total={totalIncidencias || 1}
                color={PRIORIDAD_COLORS[prio] ?? 'bg-gray-400'}
              />
            ))}
          </div>
          {totalIncidencias === 0 && (
            <p className="text-sm text-gray-400 mt-4 text-center">Sin incidencias activas</p>
          )}
        </div>
      </div>
    </div>
  );
}
