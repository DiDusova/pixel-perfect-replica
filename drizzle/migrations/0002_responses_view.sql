CREATE VIEW public.responses WITH (security_invoker = true) AS
SELECT id, session_id, phase, q1 AS current_ai_usage, interests AS learning_interests, task AS work_tasks, created_at
FROM public.survey_responses;
GRANT SELECT, INSERT ON public.responses TO anon, authenticated;
GRANT ALL ON public.responses TO service_role;