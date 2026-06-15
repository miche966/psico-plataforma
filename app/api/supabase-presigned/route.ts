import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const { fileName } = await request.json()

    if (!fileName) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from('videos-entrevista')
      .createSignedUploadUrl(fileName)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      signedUrl: data.signedUrl, 
      token: data.token, 
      path: data.path 
    })
  } catch (error: any) {
    console.error('Error generando Supabase Signed Upload URL:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
