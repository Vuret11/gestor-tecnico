const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
    throw new Error('No autorizado');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Error ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>('/auth/me'),

  dashboard: () => request<Dashboard>('/stats/dashboard'),

  visitas: {
    list: () => request<Visita[]>('/visitas'),
    hoy: () => request<Visita[]>('/visitas/hoy'),
    get: (id: string) => request<Visita>(`/visitas/${id}`),
    create: (dto: Partial<Visita> & { tecnico_id?: string; instalacion_id?: string }) =>
      request<Visita>('/visitas', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id: string, dto: Partial<Visita>) =>
      request<Visita>(`/visitas/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    delete: (id: string) => request<void>(`/visitas/${id}`, { method: 'DELETE' }),
  },

  tecnicos: {
    list: () => request<User[]>('/users'),
    create: (dto: Partial<User> & { password: string }) =>
      request<User>('/users', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id: string, dto: Partial<User>) =>
      request<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    delete: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
  },

  incidencias: {
    list: () => request<Incidencia[]>('/incidencias'),
    create: (dto: Partial<Incidencia> & { instalacion_id?: string; asignado_a_id?: string }) =>
      request<Incidencia>('/incidencias', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id: string, dto: Partial<Incidencia>) =>
      request<Incidencia>(`/incidencias/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    delete: (id: string) => request<void>(`/incidencias/${id}`, { method: 'DELETE' }),
  },

  clientes: {
    list: () => request<Cliente[]>('/clientes'),
    create: (dto: Partial<Cliente>) =>
      request<Cliente>('/clientes', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id: string, dto: Partial<Cliente>) =>
      request<Cliente>(`/clientes/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    delete: (id: string) => request<void>(`/clientes/${id}`, { method: 'DELETE' }),
  },

  instalaciones: {
    list: () => request<Instalacion[]>('/instalaciones'),
    create: (dto: Partial<Instalacion>) =>
      request<Instalacion>('/instalaciones', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id: string, dto: Partial<Instalacion>) =>
      request<Instalacion>(`/instalaciones/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    delete: (id: string) => request<void>(`/instalaciones/${id}`, { method: 'DELETE' }),
  },

  planificacion: {
    // Datos maestros
    getProvincias: () => request<PlanProvincia[]>('/planificacion/provincias'),
    createProvincia: (dto: Partial<PlanProvincia>) =>
      request<PlanProvincia>('/planificacion/provincias', { method: 'POST', body: JSON.stringify(dto) }),
    updateProvincia: (id: string, dto: Partial<PlanProvincia>) =>
      request<PlanProvincia>(`/planificacion/provincias/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),

    getTecnicos: (provinciaId?: string) =>
      request<PlanTecnico[]>(`/planificacion/tecnicos${provinciaId ? `?provinciaId=${provinciaId}` : ''}`),
    createTecnico: (dto: Partial<PlanTecnico>) =>
      request<PlanTecnico>('/planificacion/tecnicos', { method: 'POST', body: JSON.stringify(dto) }),
    updateTecnico: (id: string, dto: Partial<PlanTecnico>) =>
      request<PlanTecnico>(`/planificacion/tecnicos/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    deleteTecnico: (id: string) => request<void>(`/planificacion/tecnicos/${id}`, { method: 'DELETE' }),

    getClientes: () => request<PlanCliente[]>('/planificacion/clientes'),
    createCliente: (dto: Partial<PlanCliente>) =>
      request<PlanCliente>('/planificacion/clientes', { method: 'POST', body: JSON.stringify(dto) }),
    updateCliente: (id: string, dto: Partial<PlanCliente>) =>
      request<PlanCliente>(`/planificacion/clientes/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    deleteCliente: (id: string) => request<void>(`/planificacion/clientes/${id}`, { method: 'DELETE' }),

    getObras: (provinciaId?: string, clienteId?: string) => {
      const params = new URLSearchParams();
      if (provinciaId) params.set('provinciaId', provinciaId);
      if (clienteId) params.set('clienteId', clienteId);
      const qs = params.toString();
      return request<PlanObra[]>(`/planificacion/obras${qs ? `?${qs}` : ''}`);
    },
    createObra: (dto: Partial<PlanObra>) =>
      request<PlanObra>('/planificacion/obras', { method: 'POST', body: JSON.stringify(dto) }),
    updateObra: (id: string, dto: Partial<PlanObra>) =>
      request<PlanObra>(`/planificacion/obras/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    deleteObra: (id: string) => request<void>(`/planificacion/obras/${id}`, { method: 'DELETE' }),

    // Asignaciones
    getAsignacionesSemana: (desde: string, hasta: string, provinciaId?: string) => {
      const params = new URLSearchParams({ desde, hasta });
      if (provinciaId) params.set('provinciaId', provinciaId);
      return request<PlanAsignacion[]>(`/planificacion/asignaciones/semana?${params}`);
    },
    getAsignacionesMes: (year: number, month: number, provinciaId?: string) => {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (provinciaId) params.set('provinciaId', provinciaId);
      return request<PlanAsignacion[]>(`/planificacion/asignaciones/mes?${params}`);
    },
    getConflictos: (desde: string, hasta: string) =>
      request<PlanConflicto[]>(`/planificacion/asignaciones/conflictos?desde=${desde}&hasta=${hasta}`),
    createAsignacion: (dto: {
      tecnico_id: string; fecha: string; obra_id?: string;
      provincia_trabajo_id?: string; estadoEspecial?: string;
      viaja?: boolean; observaciones?: string;
    }) => request<PlanAsignacion>('/planificacion/asignaciones', { method: 'POST', body: JSON.stringify(dto) }),
    updateAsignacion: (id: string, dto: Partial<PlanAsignacion>) =>
      request<PlanAsignacion>(`/planificacion/asignaciones/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    deleteAsignacion: (id: string) =>
      request<void>(`/planificacion/asignaciones/${id}`, { method: 'DELETE' }),

    importar: (rows: { tecnicoNombre: string; fecha: string; contenido: string; provinciaId: string }[]) =>
      request<{ importadas: number }>('/planificacion/importar', { method: 'POST', body: JSON.stringify({ rows }) }),
  },
};

// Types
export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'oficina' | 'tecnico';
  activo: boolean;
  telefono?: string;
}

export interface Dashboard {
  visitasHoy: number;
  visitasSemana: number;
  visitasPorEstado: Record<string, number>;
  incidenciasAbiertas: number;
  incidenciasPorPrioridad: Record<string, number>;
  tecnicosActivos: number;
  instalacionesActivas: number;
  totalClientes: number;
}

export interface Visita {
  id: string;
  tipo: string;
  estado: string;
  fechaProgramada: string;
  fechaInicio?: string;
  fechaFin?: string;
  notas?: string;
  tecnico?: User;
  instalacion?: Instalacion;
}

export interface Incidencia {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  createdAt: string;
  instalacion?: Instalacion;
  asignadoA?: User;
}

export interface Cliente {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
}

export interface Instalacion {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  cliente?: string;
  activa: boolean;
}

// ── Planificación ─────────────────────────────────────────────────────────────
export interface PlanProvincia {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
}

export interface PlanTecnico {
  id: string;
  nombre: string;
  matricula?: string;
  tipo: 'propio' | 'externo' | 'subcontrata';
  provincia?: PlanProvincia;
  provincia_id?: string;
  telefono?: string;
  email?: string;
  observaciones?: string;
  activo: boolean;
  viaja: boolean;
}

export interface PlanCliente {
  id: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  observaciones?: string;
  activo: boolean;
}

export interface PlanObra {
  id: string;
  numeroObra: string;
  nombre: string;
  cliente?: PlanCliente;
  cliente_id?: string;
  provincia?: PlanProvincia;
  provincia_id?: string;
  direccion?: string;
  ciudad?: string;
  tipoTrabajo: 'instalacion_fv' | 'instalacion_aerotermia' | 'mantenimiento' | 'incidencia' | 'visita_tecnica' | 'otro';
  estado: 'pendiente' | 'planificada' | 'confirmada' | 'en_curso' | 'realizada' | 'cancelada' | 'reprogramada';
  fechaPrevista?: string;
  fechaRealizada?: string;
  observaciones?: string;
  activo: boolean;
}

export type EstadoEspecial =
  | 'vacaciones' | 'baja' | 'comp_horas' | 'libre'
  | 'fiesta_nacional' | 'medico' | 'sancion'
  | 'reconocimiento' | 'otros';

export interface PlanAsignacion {
  id: string;
  tecnico: PlanTecnico;
  tecnico_id: string;
  obra?: PlanObra;
  obra_id?: string;
  fecha: string;
  provinciatrabajo?: PlanProvincia;
  provincia_trabajo_id?: string;
  estadoEspecial?: EstadoEspecial | null;
  viaja: boolean;
  observaciones?: string;
  createdAt: string;
}

export interface PlanConflicto {
  tipo: string;
  mensaje: string;
  tecnico: PlanTecnico;
  fecha: string;
  asignaciones: PlanAsignacion[];
}
