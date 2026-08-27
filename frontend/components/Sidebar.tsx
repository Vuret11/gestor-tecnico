'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getUser } from '@/lib/auth';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/visitas', label: 'Visitas', icon: '📅' },
  { href: '/dashboard/incidencias', label: 'Incidencias', icon: '⚠️' },
  { href: '/dashboard/instalaciones', label: 'Instalaciones', icon: '🏠' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: '👥' },
  { href: '/dashboard/tecnicos', label: 'Técnicos', icon: '🔧' },
  { href: '/dashboard/planificacion', label: 'Planificación', icon: '🗓️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  function logout() {
    clearSession();
    router.push('/');
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-gray-900 flex flex-col z-10">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">GT</div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Gestor Técnico</p>
            <p className="text-gray-400 text-xs">HomeServe</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(l => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {user?.nombre?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.nombre ?? 'Usuario'}</p>
            <p className="text-gray-400 text-xs capitalize">{user?.rol}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-gray-400 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-gray-800 transition"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
