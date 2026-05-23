// One-time script to create RLS policies for storage buckets
// Run: node scripts/create-storage-policies.mjs

const SUPABASE_URL = 'https://vyhfdvldyefwnsnzvzyw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const sql = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Public read event_image' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Public read event_image" ON storage.objects FOR SELECT USING (bucket_id = 'event_image');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Public read images' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Public read images" ON storage.objects FOR SELECT USING (bucket_id = 'images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Public read main_images' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Public read main_images" ON storage.objects FOR SELECT USING (bucket_id = 'main_images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Auth write event_image' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Auth write event_image" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'event_image') WITH CHECK (bucket_id = 'event_image');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Auth write images' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Auth write images" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'images') WITH CHECK (bucket_id = 'images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Auth write main_images' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Auth write main_images" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'main_images') WITH CHECK (bucket_id = 'main_images');
  END IF;
END $$;
`;

const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'apikey': SERVICE_ROLE_KEY,
    'Prefer': 'params=single-object',
  },
  body: JSON.stringify({ query: sql }),
});

// The REST API doesn't support raw SQL — use the pg endpoint via Supabase CLI
// instead, run this SQL directly in the Supabase dashboard SQL editor:
console.log('\nPaste this SQL in your Supabase dashboard > SQL Editor:\n');
console.log(sql);
