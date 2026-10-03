ALTER TABLE public.survey_responses ADD COLUMN survey_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.survey_responses ADD COLUMN interaction_level text
  CHECK (interaction_level IS NULL OR interaction_level IN ('level_1_unknown','level_2_search','level_3_improver','level_4_assistant','level_5_thinking_partner'));
ALTER TABLE public.survey_responses ADD COLUMN ai_attitude text
  CHECK (ai_attitude IS NULL OR ai_attitude IN ('attitude_1_no_value','attitude_2_anxious','attitude_3_trying','attitude_4_respect','attitude_5_love'));
ALTER TABLE public.survey_responses ALTER COLUMN q1 DROP NOT NULL;
COMMENT ON COLUMN public.survey_responses.q1 IS 'DEPRECATED for survey_version 2: replaced by interaction_level';
CREATE INDEX IF NOT EXISTS survey_responses_v_idx ON public.survey_responses(session_id, phase, survey_version);
CREATE OR REPLACE VIEW public.responses WITH (security_invoker = true) AS
SELECT id, session_id, phase, q1 AS current_ai_usage, interests AS learning_interests, task AS work_tasks, created_at,
       survey_version, interaction_level, ai_attitude
FROM public.survey_responses;
GRANT SELECT, INSERT ON public.responses TO anon, authenticated;