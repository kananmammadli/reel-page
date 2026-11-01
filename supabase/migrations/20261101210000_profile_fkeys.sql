-- chat_messages.user_id/questions.user_id/reports.reporter_id all
-- reference auth.users, not public.profiles -- so PostgREST (which embeds
-- related resources off real foreign keys) couldn't find a relationship
-- to join display_name/role from profiles, and every chat/Q&A/reports
-- query that tried to embed `profiles(...)` failed with PGRST200. A
-- second FK to profiles on the same column is safe: handle_new_user
-- creates a profiles row for every auth.users row in the same
-- transaction, so the two are always in lockstep.
alter table chat_messages add constraint chat_messages_user_id_profiles_fkey foreign key (user_id) references profiles (id) on delete cascade;
alter table questions add constraint questions_user_id_profiles_fkey foreign key (user_id) references profiles (id) on delete cascade;
alter table reports add constraint reports_reporter_id_profiles_fkey foreign key (reporter_id) references profiles (id) on delete cascade;
