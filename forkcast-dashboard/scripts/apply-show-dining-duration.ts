import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  try {
    console.log('🚀 Starting show_dining_duration migration...')

    const migrationPath = join(process.cwd(), 'supabase/migrations/20251217170000_add_show_dining_duration.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration SQL loaded successfully')
    
    // Execute SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    })

    if (error) {
        // Fallback: Try direct execution if RPC fails or doesn't exist (though usually implies direct connection which we don't have via JS client easily without connection string)
        console.error('❌ Error executing migration via exec_sql RPC:', error)
        console.log('Attempting direct REST execution for DDL (usually fails)...')
        
        // As a last ditch effort, try to inspect if the column exists to see if we really failed or if the error is misleading
        const { error: checkError } = await supabase
            .from('restaurants')
            .select('show_dining_duration')
            .limit(1)
            
        if (!checkError || (checkError && checkError.code !== 'PGRST301')) { // PGRST301 is "Relation does not exist" or column missing often throws specific error
             if (!checkError) {
                 console.log('✅ It seems the column might already exist or was created despite error.')
                 return
             }
        }
        
        throw error
    }

    console.log('✅ Migration executed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

applyMigration()
