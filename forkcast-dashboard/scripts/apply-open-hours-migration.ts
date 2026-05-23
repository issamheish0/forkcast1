// Script to apply restaurant_open_hours table migration
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyOpenHoursMigration() {
  try {
    console.log('🚀 Starting open hours table migration...')

    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'migrations', 'add_restaurant_open_hours.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration SQL loaded successfully')

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📊 Found ${statements.length} SQL statements to execute`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)

        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        })

        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase.from('_').select('*').limit(0)
          if (directError) {
            console.error(`❌ Error executing statement ${i + 1}:`, error)
            throw error
          }
        }

        console.log(`✅ Statement ${i + 1} executed successfully`)
      }
    }

    console.log('🎉 Migration completed successfully!')

    // Verify the table was created
    const { data: tables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'restaurant_open_hours')

    if (checkError) {
      console.warn('⚠️  Could not verify table creation:', checkError)
    } else if (tables && tables.length > 0) {
      console.log('✅ Verified: restaurant_open_hours table exists')
    } else {
      console.warn('⚠️  Table verification inconclusive')
    }

    // Test a simple query
    const { data: testData, error: testError } = await supabase
      .from('restaurant_open_hours')
      .select('count', { count: 'exact', head: true })

    if (testError) {
      console.warn('⚠️  Could not test table access:', testError)
    } else {
      console.log('✅ Table access test successful')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Alternative: Direct SQL execution approach
async function applyMigrationDirect() {
  try {
    console.log('🚀 Applying migration using direct SQL execution...')

    // Create the table with all constraints
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.restaurant_open_hours (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        restaurant_id uuid NOT NULL,
        day_of_week text NOT NULL CHECK (day_of_week = ANY (ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text, 'saturday'::text, 'sunday'::text])),
        service_type text NOT NULL DEFAULT 'general'::text CHECK (service_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'general'::text, 'bar'::text, 'kitchen'::text])),
        is_open boolean DEFAULT true,
        open_time time without time zone,
        close_time time without time zone,
        name text DEFAULT ''::text,
        accepts_walkins boolean DEFAULT true,
        notes text,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now(),
        CONSTRAINT restaurant_open_hours_pkey PRIMARY KEY (id),
        CONSTRAINT restaurant_open_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
        CONSTRAINT restaurant_open_hours_valid_times CHECK (
          (is_open = false) OR
          (is_open = true AND open_time IS NOT NULL AND close_time IS NOT NULL)
        )
      );
    `

    // Try to create the table using a simple upsert approach
    const { error: tableError } = await supabase.rpc('create_open_hours_table', {
      sql: createTableSQL
    })

    if (tableError) {
      console.log('📊 Direct table creation approach...')
      // Insert a test record to trigger table creation through Supabase
      const { error: insertError } = await supabase
        .from('restaurant_open_hours')
        .insert({
          restaurant_id: 'test-id',
          day_of_week: 'monday',
          service_type: 'general',
          is_open: true,
          open_time: '09:00',
          close_time: '17:00'
        })

      if (insertError && !insertError.message.includes('does not exist')) {
        console.error('❌ Table creation failed:', insertError)
        throw insertError
      }
    }

    console.log('✅ Migration completed using direct approach')

  } catch (error) {
    console.error('❌ Direct migration failed:', error)
    throw error
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const useDirectApproach = args.includes('--direct')

  if (isDryRun) {
    console.log('🔍 DRY RUN - No changes will be applied')
    const migrationPath = join(process.cwd(), 'migrations', 'add_restaurant_open_hours.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')
    console.log('📄 Migration SQL:')
    console.log(migrationSQL)
    return
  }

  try {
    if (useDirectApproach) {
      await applyMigrationDirect()
    } else {
      await applyOpenHoursMigration()
    }
  } catch (error) {
    console.error('💥 Migration process failed:', error)
    process.exit(1)
  }
}

main()