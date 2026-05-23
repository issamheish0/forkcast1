-- Surveys table - stores available surveys
CREATE TABLE IF NOT EXISTS public.surveys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  min_bookings integer DEFAULT 1, -- Minimum bookings required to show survey
  priority integer DEFAULT 0, -- Higher priority shows first
  starts_at timestamp with time zone DEFAULT now(),
  ends_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT surveys_pkey PRIMARY KEY (id)
);

-- Survey responses table - stores user responses
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL,
  user_id uuid NOT NULL,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed boolean DEFAULT false,
  dismissed boolean DEFAULT false, -- True if user dismissed without completing
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT survey_responses_pkey PRIMARY KEY (id),
  CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE,
  CONSTRAINT survey_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT survey_responses_unique UNIQUE (survey_id, user_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_surveys_active ON public.surveys(is_active);
CREATE INDEX IF NOT EXISTS idx_surveys_dates ON public.surveys(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_surveys_priority ON public.surveys(priority DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user ON public.survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON public.survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_completed ON public.survey_responses(completed);

-- Enable RLS
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Surveys: public read access
CREATE POLICY "Allow public read access on surveys"
  ON public.surveys
  FOR SELECT
  USING (true);

-- Surveys: authenticated users can manage (for admin)
CREATE POLICY "Allow authenticated users to manage surveys"
  ON public.surveys
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Survey responses: users can view their own responses
CREATE POLICY "Users can view their own survey responses"
  ON public.survey_responses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Survey responses: users can insert their own responses
CREATE POLICY "Users can insert their own survey responses"
  ON public.survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Survey responses: users can update their own responses
CREATE POLICY "Users can update their own survey responses"
  ON public.survey_responses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin policy: allow admins to view all responses
CREATE POLICY "Admins can view all survey responses"
  ON public.survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rbs_admins
      WHERE user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE public.surveys IS 'Stores survey definitions with questions in JSON format';
COMMENT ON TABLE public.survey_responses IS 'Stores user responses to surveys, including dismissals';
COMMENT ON COLUMN public.surveys.questions IS 'JSON array of question objects with type, question text, options, etc.';
COMMENT ON COLUMN public.surveys.min_bookings IS 'Minimum number of bookings a user needs to see this survey';
COMMENT ON COLUMN public.surveys.priority IS 'Higher priority surveys show first';
COMMENT ON COLUMN public.survey_responses.responses IS 'JSON object mapping question IDs to user answers';
COMMENT ON COLUMN public.survey_responses.dismissed IS 'True if user closed survey without completing';
