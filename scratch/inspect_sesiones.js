
const { createClient } = require('@supabase/supabase-client')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function inspect() {
  const { data, error } = await supabase.from('sesiones').select('*').limit(1)
  if (error) console.error(error)
  else console.log('COLUMNS:', Object.keys(data[0]))
}
inspect()
