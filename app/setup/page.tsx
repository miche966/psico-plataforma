'use client'

import { supabase } from '@/lib/supabase'

export default function Setup() {
  async function crearUsuario() {
    const { data, error } = await supabase.auth.signUp({
      email: 'michelochoa1530@gmail.com',
      password: 'Psico2026'
    })
    console.log('data:', JSON.stringify(data))
    console.log('error:', JSON.stringify(error))
    alert(error ? 'Error: ' + error.message : 'Usuario creado. Revisá la consola.')
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <button onClick={crearUsuario}>Crear usuario</button>
    </div>
  )
}