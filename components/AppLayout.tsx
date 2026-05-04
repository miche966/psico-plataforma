'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, FileText, BarChart3, Video, LogOut, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [novedades, setNovedades] = useState(0)

  useEffect(() => {
    const checkNewResults = async () => {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('sesiones')
        .select('*', { count: 'exact', head: true })
        .gt('finalizada_en', hace24h)
      
      if (count) setNovedades(count)
    }
    checkNewResults()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-slate-100">
          <Link href="/panel" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">PsicoPlataforma</span>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-6">
          {/* SECCIÓN: PLATAFORMA */}
          <div>
            <h4 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Plataforma</h4>
            <div className="space-y-1">
              {[
                { href: '/panel', label: 'Centro de Control', icon: LayoutDashboard },
                { href: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
                { href: '/candidatos', label: 'Base de Candidatos', icon: Users },
                { href: '/entrevista-video', label: 'Librería Video', icon: Video },
              ].map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    {!isActive && item.href === '/panel' && novedades > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-sm animate-pulse">
                        {novedades}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-200 text-sm"
          >
            <LogOut className="w-5 h-5 text-slate-400" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
