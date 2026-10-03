ALTER TABLE public.survey_responses DROP CONSTRAINT IF EXISTS survey_responses_q2_check;
ALTER TABLE public.survey_responses ALTER COLUMN q2 SET DEFAULT 'v2';
ALTER TABLE public.survey_responses DROP CONSTRAINT IF EXISTS survey_responses_task_check;
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_task_len CHECK (task IS NULL OR char_length(task) <= 2000);
ALTER TABLE public.survey_responses ADD COLUMN interests text[] NOT NULL DEFAULT '{}'
  CHECK (interests <@ ARRAY['apps','delegate','files','automate','assistants','analysis','unsure']);
COMMENT ON COLUMN public.survey_responses.q2 IS 'DEPRECATED: replaced by interests';
COMMENT ON COLUMN public.survey_responses.q3 IS 'DEPRECATED: replaced by interests';