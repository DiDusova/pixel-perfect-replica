CREATE TABLE public.survey_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.survey_sessions TO anon, authenticated;
GRANT ALL ON public.survey_sessions TO service_role;
ALTER TABLE public.survey_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions readable" ON public.survey_sessions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.survey_sessions(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'before' CHECK (phase IN ('before','after')),
  q1 text NOT NULL CHECK (q1 IN ('none','chat','work','files','agents')),
  q2 text NOT NULL CHECK (q2 IN ('think','create','access','automate','delegate','assistant','unsure')),
  q3 text[] NOT NULL DEFAULT '{}' CHECK (cardinality(q3) <= 3 AND q3 <@ ARRAY['think','create','access','automate','delegate','assistant']),
  task text CHECK (task IS NULL OR char_length(task) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.survey_responses(session_id, phase);
GRANT SELECT, INSERT ON public.survey_responses TO anon, authenticated;
GRANT ALL ON public.survey_responses TO service_role;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can answer" ON public.survey_responses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anonymous results readable" ON public.survey_responses FOR SELECT TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_responses;

INSERT INTO public.survey_sessions (slug, title) VALUES ('demo', 'Демо-группа');