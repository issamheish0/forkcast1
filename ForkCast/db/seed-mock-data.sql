-- ============================================================
-- ForkCast — Seed Mock Data
-- Paste into Supabase SQL Editor and run AFTER booking-core.sql
-- UUID scheme:
--   Restaurants : 00000000-0000-0000-0000-0000000000NN  (01-10)
--   Sections    : 00000000-0000-0000-0001-0000000000NN  (01-10)
--   Tables      : 00000000-0000-0000-0002-00000000NNNN  (0001-0030)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- RESTAURANTS (10)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.restaurants (
  id, name, cuisine_type, secondary_cuisines, address,
  location, latitude, longitude,
  main_image_url, price_range, average_rating, total_reviews,
  status, featured, tier, booking_policy,
  scratch_card_enabled, outdoor_seating, valet_parking,
  parking_available, shisha_available,
  max_party_size, min_party_size,
  booking_window_days, cancellation_window_hours,
  review_summary, created_at, updated_at
) VALUES

('00000000-0000-0000-0000-000000000001',
 'Noura Lebanese Kitchen', 'Lebanese', ARRAY['Middle Eastern'],
 'Jumeirah Beach Road, Dubai',
 ST_SetSRID(ST_MakePoint(55.2008,25.1412),4326)::geography, 25.1412, 55.2008,
 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
 2, 4.7, 312, 'active', true, 'pro'::public.tier, 'instant',
 true, true, true, true, false, 10, 1, 30, 24,
 '{"total_reviews":312,"average_rating":4.7,"rating_distribution":{"1":2,"2":5,"3":18,"4":87,"5":200},"detailed_ratings":{"food_avg":4.8,"service_avg":4.6,"ambiance_avg":4.7,"value_avg":4.5},"recommendation_percentage":95}',
 '2024-01-01T00:00:00Z','2025-01-01T00:00:00Z'),

('00000000-0000-0000-0000-000000000002',
 'Sakura Japanese Bistro', 'Japanese', ARRAY['Sushi','Asian Fusion'],
 'Downtown Dubai, UAE',
 ST_SetSRID(ST_MakePoint(55.2747,25.1972),4326)::geography, 25.1972, 55.2747,
 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80',
 3, 4.8, 521, 'active', true, 'pro'::public.tier, 'instant',
 false, false, true, true, false, 10, 1, 30, 24,
 '{"total_reviews":521,"average_rating":4.8,"rating_distribution":{"1":3,"2":8,"3":25,"4":110,"5":375},"detailed_ratings":{"food_avg":4.9,"service_avg":4.8,"ambiance_avg":4.7,"value_avg":4.6},"recommendation_percentage":97}',
 '2024-02-01T00:00:00Z','2025-01-01T00:00:00Z'),

('00000000-0000-0000-0000-000000000003',
 'Tuscany Trattoria', 'Italian', ARRAY['Mediterranean','Pizza'],
 'DIFC, Dubai',
 ST_SetSRID(ST_MakePoint(55.2856,25.2123),4326)::geography, 25.2123, 55.2856,
 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
 3, 4.5, 218, 'active', false, 'pro'::public.tier, 'instant',
 true, true, false, true, false, 10, 1, 30, 24,
 '{"total_reviews":218,"average_rating":4.5,"rating_distribution":{"1":4,"2":9,"3":30,"4":75,"5":100},"detailed_ratings":{"food_avg":4.6,"service_avg":4.4,"ambiance_avg":4.7,"value_avg":4.3},"recommendation_percentage":90}',
 '2024-03-01T00:00:00Z','2025-01-01T00:00:00Z'),

('00000000-0000-0000-0000-000000000004',
 'Spice Route Indian Kitchen', 'Indian', ARRAY['South Asian','Vegetarian-Friendly'],
 'Bur Dubai, UAE',
 ST_SetSRID(ST_MakePoint(55.3047,25.2577),4326)::geography, 25.2577, 55.3047,
 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
 1, 4.6, 487, 'active', false, 'basic'::public.tier, 'request',
 false, false, false, false, false, 8, 1, 30, 24,
 '{"total_reviews":487,"average_rating":4.6,"rating_distribution":{"1":5,"2":10,"3":40,"4":132,"5":300},"detailed_ratings":{"food_avg":4.7,"service_avg":4.5,"ambiance_avg":4.3,"value_avg":4.8},"recommendation_percentage":93}',
 '2024-04-01T00:00:00Z','2025-01-01T00:00:00Z'),

('00000000-0000-0000-0000-000000000005',
 'The Grill House', 'American', ARRAY['Steakhouse','Burgers'],
 'Business Bay, Dubai',
 ST_SetSRID(ST_MakePoint(55.2643,25.1856),4326)::geography, 25.1856, 55.2643,
 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
 2, 4.3, 156, 'active', true, 'pro'::public.tier, 'instant',
 true, true, true, true, false, 12, 1, 30, 24,
 '{"total_reviews":156,"average_rating":4.3,"rating_distribution":{"1":6,"2":12,"3":28,"4":60,"5":50},"detailed_ratings":{"food_avg":4.5,"service_avg":4.2,"ambiance_avg":4.3,"value_avg":4.1},"recommendation_percentage":86}',
 '2024-05-01T00:00:00Z','2025-01-01T00:00:00Z'),

('00000000-0000-0000-0000-000000000006',
 'Coco Thai Garden', 'Thai', ARRAY['Asian','Seafood'],
 'JBR Walk, Dubai',
 ST_SetSRID(ST_MakePoint(55.1385,25.0762),4326)::geography, 25.0762, 55.1385,
 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=800&q=80',
 2, 4.4, 203, 'active', false, 'pro'::public.tier, 'instant',
 false, true, false, true, false, 10, 1, 30, 24,
 '{"total_reviews":203,"average_rating":4.4,"rating_distribution":{"1":3,"2":8,"3":30,"4":82,"5":80},"detailed_ratings":{"food_avg":4.5,"service_avg":4.3,"ambiance_avg":4.6,"value_avg":4.2},"recommendation_percentage":88}',
 '2024-06-01T00:00:00Z','2025-01-01T00:00:00Z'),

('00000000-0000-0000-0000-000000000007',
 'La Maison French Brasserie', 'French', ARRAY['European','Bistro'],
 'Madinat Jumeirah, Dubai',
 ST_SetSRID(ST_MakePoint(55.1856,25.1298),4326)::geography, 25.1298, 55.1856,
 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
 4, 4.9, 289, 'active', true, 'pro'::public.tier, 'instant',
 false, true, true, true, false, 10, 1, 30, 48,
 '{"total_reviews":289,"average_rating":4.9,"rating_distribution":{"1":1,"2":3,"3":10,"4":55,"5":220},"detailed_ratings":{"food_avg":5.0,"service_avg":4.9,"ambiance_avg":4.9,"value_avg":4.7},"recommendation_percentage":98}',
 '2024-07-01T00:00:00Z','2025-01-01T00:00:00Z'),

('00000000-0000-0000-0000-000000000008',
 'Mezze & More', 'Turkish', ARRAY['Mediterranean','Middle Eastern'],
 'Al Quoz, Dubai',
 ST_SetSRID(ST_MakePoint(55.2325,25.1534),4326)::geography, 25.1534, 55.2325,
 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=800&q=80',
 2, 4.2, 134, 'active', false, 'basic'::public.tier, 'request',
 false, false, false, true, true, 8, 1, 30, 24,
 '{"total_reviews":134,"average_rating":4.2,"rating_distribution":{"1":5,"2":10,"3":25,"4":54,"5":40},"detailed_ratings":{"food_avg":4.3,"service_avg":4.1,"ambiance_avg":4.2,"value_avg":4.4},"recommendation_percentage":84}',
 '2024-08-01T00:00:00Z','2025-01-01T00:00:00Z'),

('00000000-0000-0000-0000-000000000009',
 'Seoul Garden Korean BBQ', 'Korean', ARRAY['BBQ','Asian'],
 'Deira City Centre, Dubai',
 ST_SetSRID(ST_MakePoint(55.3308,25.2512),4326)::geography, 25.2512, 55.3308,
 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&q=80',
 2, 4.6, 378, 'active', false, 'pro'::public.tier, 'instant',
 true, false, false, true, false, 10, 1, 30, 24,
 '{"total_reviews":378,"average_rating":4.6,"rating_distribution":{"1":3,"2":8,"3":35,"4":132,"5":200},"detailed_ratings":{"food_avg":4.7,"service_avg":4.5,"ambiance_avg":4.4,"value_avg":4.6},"recommendation_percentage":92}',
 '2024-09-01T00:00:00Z','2025-01-01T00:00:00Z'),

('00000000-0000-0000-0000-000000000010',
 'Zest Mediterranean Grill', 'Mediterranean', ARRAY['Greek','Seafood'],
 'Palm Jumeirah, Dubai',
 ST_SetSRID(ST_MakePoint(55.1365,25.1124),4326)::geography, 25.1124, 55.1365,
 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80',
 3, 4.7, 445, 'active', true, 'pro'::public.tier, 'instant',
 false, true, true, true, false, 10, 1, 30, 24,
 '{"total_reviews":445,"average_rating":4.7,"rating_distribution":{"1":3,"2":7,"3":35,"4":150,"5":250},"detailed_ratings":{"food_avg":4.8,"service_avg":4.7,"ambiance_avg":4.9,"value_avg":4.5},"recommendation_percentage":95}',
 '2024-10-01T00:00:00Z','2025-01-01T00:00:00Z')

ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- OPEN HOURS  (Mon-Sun, noon-11pm)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.restaurant_open_hours
  (restaurant_id, day_of_week, service_type, is_open, open_time, close_time)
SELECT r.id, d.day, 'general', true, '12:00:00'::time, '23:00:00'::time
FROM public.restaurants r
CROSS JOIN (VALUES
  ('monday'),('tuesday'),('wednesday'),('thursday'),
  ('friday'),('saturday'),('sunday')
) AS d(day)
WHERE r.id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000010'
)
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- SECTIONS  (one indoor section per restaurant)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.restaurant_sections
  (id, restaurant_id, name, description, display_order, is_active, max_covers)
VALUES
  ('00000000-0000-0000-0001-000000000001','00000000-0000-0000-0000-000000000001','Main Dining','Indoor main area',0,true,60),
  ('00000000-0000-0000-0001-000000000002','00000000-0000-0000-0000-000000000002','Main Dining','Indoor main area',0,true,50),
  ('00000000-0000-0000-0001-000000000003','00000000-0000-0000-0000-000000000003','Main Dining','Indoor main area',0,true,55),
  ('00000000-0000-0000-0001-000000000004','00000000-0000-0000-0000-000000000004','Main Dining','Indoor main area',0,true,40),
  ('00000000-0000-0000-0001-000000000005','00000000-0000-0000-0000-000000000005','Main Dining','Indoor main area',0,true,70),
  ('00000000-0000-0000-0001-000000000006','00000000-0000-0000-0000-000000000006','Main Dining','Indoor main area',0,true,45),
  ('00000000-0000-0000-0001-000000000007','00000000-0000-0000-0000-000000000007','Main Dining','Indoor main area',0,true,50),
  ('00000000-0000-0000-0001-000000000008','00000000-0000-0000-0000-000000000008','Main Dining','Indoor main area',0,true,35),
  ('00000000-0000-0000-0001-000000000009','00000000-0000-0000-0000-000000000009','Main Dining','Indoor main area',0,true,60),
  ('00000000-0000-0000-0001-000000000010','00000000-0000-0000-0000-000000000010','Main Dining','Indoor main area',0,true,65)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- TABLES  (3 per restaurant)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.restaurant_tables
  (id, restaurant_id, section_id, table_number, table_type, capacity,
   min_capacity, max_capacity, x_position, y_position, is_active, default_booking_type)
VALUES
  ('00000000-0000-0000-0002-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0001-000000000001','T1','standard',2,1,2,10,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0001-000000000001','T2','standard',4,2,4,20,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0001-000000000001','T3','booth',  6,4,6,30,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000004','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0001-000000000002','T1','standard',2,1,2,10,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000005','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0001-000000000002','T2','standard',4,2,4,20,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000006','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0001-000000000002','T3','booth',  6,4,6,30,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000007','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0001-000000000003','T1','standard',2,1,2,10,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000008','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0001-000000000003','T2','standard',4,2,4,20,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000009','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0001-000000000003','T3','booth',  8,6,8,30,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000010','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0001-000000000004','T1','standard',2,1,2,10,10,true,'request'),
  ('00000000-0000-0000-0002-000000000011','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0001-000000000004','T2','standard',4,2,4,20,10,true,'request'),
  ('00000000-0000-0000-0002-000000000012','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0001-000000000004','T3','standard',6,4,6,30,10,true,'request'),
  ('00000000-0000-0000-0002-000000000013','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0001-000000000005','T1','standard',2,1,2,10,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000014','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0001-000000000005','T2','standard',4,2,4,20,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000015','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0001-000000000005','T3','booth',  8,6,8,30,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000016','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0001-000000000006','T1','standard',2,1,2,10,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000017','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0001-000000000006','T2','standard',4,2,4,20,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000018','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0001-000000000006','T3','patio',  6,4,6,30,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000019','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0001-000000000007','T1','standard',2,1,2,10,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000020','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0001-000000000007','T2','standard',4,2,4,20,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000021','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0001-000000000007','T3','private',8,6,8,30,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000022','00000000-0000-0000-0000-000000000008','00000000-0000-0000-0001-000000000008','T1','standard',2,1,2,10,10,true,'request'),
  ('00000000-0000-0000-0002-000000000023','00000000-0000-0000-0000-000000000008','00000000-0000-0000-0001-000000000008','T2','standard',4,2,4,20,10,true,'request'),
  ('00000000-0000-0000-0002-000000000024','00000000-0000-0000-0000-000000000008','00000000-0000-0000-0001-000000000008','T3','standard',6,4,6,30,10,true,'request'),
  ('00000000-0000-0000-0002-000000000025','00000000-0000-0000-0000-000000000009','00000000-0000-0000-0001-000000000009','T1','standard',2,1,2,10,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000026','00000000-0000-0000-0000-000000000009','00000000-0000-0000-0001-000000000009','T2','standard',4,2,4,20,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000027','00000000-0000-0000-0000-000000000009','00000000-0000-0000-0001-000000000009','T3','booth',  6,4,6,30,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000028','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0001-000000000010','T1','standard',2,1,2,10,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000029','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0001-000000000010','T2','standard',4,2,4,20,10,true,'instant'),
  ('00000000-0000-0000-0002-000000000030','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0001-000000000010','T3','patio',  8,6,8,30,10,true,'instant')
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────────────────────
SELECT 'restaurants' AS tbl, COUNT(*) FROM public.restaurants           WHERE id::text LIKE '00000000-0000-0000-0000-%'
UNION ALL
SELECT 'open_hours',          COUNT(*) FROM public.restaurant_open_hours WHERE restaurant_id::text LIKE '00000000-0000-0000-0000-%'
UNION ALL
SELECT 'sections',            COUNT(*) FROM public.restaurant_sections   WHERE id::text LIKE '00000000-0000-0000-0001-%'
UNION ALL
SELECT 'tables',              COUNT(*) FROM public.restaurant_tables     WHERE id::text LIKE '00000000-0000-0000-0002-%';
