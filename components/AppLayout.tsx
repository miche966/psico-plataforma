'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAdminRole } from '@/lib/useAdminRole'
import { useGateMfa } from '@/lib/useGateMfa'
import { getAdminHeaders } from '@/lib/evaluacionLink'

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { role, mfaRequerido } = useAdminRole()
  useGateMfa(mfaRequerido)
  const [novedades, setNovedades] = useState(0)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    } else {
      setIsDarkMode(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode
    setIsDarkMode(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  useEffect(() => {
    const checkNewResults = async () => {
      try {
        const headers = await getAdminHeaders()
        const res = await fetch('/api/admin/novedades', { headers, cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (res.ok && typeof data.novedades === 'number') setNovedades(data.novedades)
      } catch {
        // sesion admin no disponible todavia (ej. recien montado antes de hidratar auth) -- sin novedades por ahora
      }
    }
    checkNewResults()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const enlaces = [
    { href: '/panel', label: 'Centro de control' },
    { href: '/estadisticas', label: 'Estadísticas' },
    { href: '/candidatos', label: 'Base de candidatos' },
    { href: '/entrevista-video', label: 'Librería de video' },
    ...(role === 'admin' ? [{ href: '/accesos', label: 'Accesos' }] : []),
    { href: '/seguridad', label: 'Seguridad' },
  ]

  return (
    <div className="admin-shell min-h-screen bg-slate-50 flex">
      {/* Barra lateral */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10">
        <div className="px-6 pt-6 pb-5">
          <Link href="/panel" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#17594E" />
              <circle cx="12" cy="16" r="5.6" fill="none" stroke="#FFFFFF" strokeWidth="2.6" />
              <rect x="19" y="12" width="9" height="8" rx="2" fill="#F5D547" />
            </svg>
            <span className="font-semibold text-slate-900 text-lg" style={{ fontFamily: 'var(--font-lectura), Georgia, serif' }}>PsicoPlataforma</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 pb-4" aria-label="Principal">
          <div className="space-y-1">
            {enlaces.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-bold shadow-[inset_4px_0_0_#f5d547]'
                      : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  {!isActive && item.href === '/panel' && novedades > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-bold text-white" aria-label={`${novedades} novedades`}>
                      {novedades}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-1">
          <button
            type="button"
            onClick={toggleDarkMode}
            role="switch"
            aria-checked={isDarkMode}
            className="flex items-center justify-between px-3 py-2.5 w-full rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <span>Modo oscuro</span>
            <span className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`} />
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center px-3 py-2.5 w-full rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm font-medium"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
