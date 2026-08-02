import { NextResponse } from 'next/server'

function allowedAdminEmails() {
  return (process.env.ADMIN_EMAILS || 'mochoa@republicamicrofinanzas.com.uy')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

export async function requireAdminSession(req: Request) {
  const authorization = req.headers.get('authorization')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !anonKey) {
    return { response: NextResponse.json({ error: 'Sesion administrativa requerida' }, { status: 401 }) }
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
    cache: 'no-store',
  })

  if (!userResponse.ok) {
    return { response: NextResponse.json({ error: 'Sesion administrativa invalida o vencida' }, { status: 401 }) }
  }

  const user = await userResponse.json()
  const email = String(user.email || '').trim().toLowerCase()
  if (!email || !allowedAdminEmails().includes(email)) {
    return { response: NextResponse.json({ error: 'La cuenta no esta autorizada para esta operacion' }, { status: 403 }) }
  }

  return { user }
}