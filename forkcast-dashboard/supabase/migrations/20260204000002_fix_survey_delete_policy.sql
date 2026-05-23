-- Fix survey delete policies

-- Drop existing survey policies and recreate with explicit permissions
DROP POLICY IF EXISTS "Allow public read access on surveys" ON public.surveys;
DROP POLICY IF EXISTS "Allow authenticated users to manage surveys" ON public.surveys;

-- Surveys: public read access
CREATE POLICY "surveys_public_read"
  ON public.surveys
  FOR SELECT
  USING (true);

-- Surveys: admins can insert
CREATE POLICY "surveys_admin_insert"
  ON public.surveys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rbs_admins
      WHERE user_id = auth.uid()
    )
  );

-- Surveys: admins can update
CREATE POLICY "surveys_admin_update"
  ON public.surveys
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rbs_admins
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rbs_admins
      WHERE user_id = auth.uid()
    )
  );

-- Surveys: admins can delete
CREATE POLICY "surveys_admin_delete"
  ON public.surveys
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rbs_admins
      WHERE user_id = auth.uid()
    )
  );

-- Add admin delete policy for survey_responses (needed for cascade or manual delete)
CREATE POLICY "Admins can delete survey responses"
  ON public.survey_responses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rbs_admins
      WHERE user_id = auth.uid()
    )
  );

-- Recreate admin SELECT policy for survey_responses (in case it doesn't exist)
DROP POLICY IF EXISTS "Admins can view all survey responses" ON public.survey_responses;
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
