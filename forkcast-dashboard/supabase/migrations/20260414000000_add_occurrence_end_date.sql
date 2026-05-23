-- Add end_date column to event_occurrences for multi-day occurrences
ALTER TABLE public.event_occurrences
ADD COLUMN end_date date;
