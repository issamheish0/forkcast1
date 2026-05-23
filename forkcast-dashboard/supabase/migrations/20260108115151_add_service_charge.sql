ALTER TABLE restaurant_events 
ADD COLUMN IF NOT EXISTS service_charge_percentage numeric DEFAULT 0;

COMMENT ON COLUMN restaurant_events.service_charge_percentage IS 'Service charge percentage for the event (e.g. 10 for 10%)';
