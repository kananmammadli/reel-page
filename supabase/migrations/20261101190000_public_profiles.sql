-- Club chat/Q&A need to show who posted each message (display name) and
-- whether they're the host (role), for every poster -- not just the
-- viewer's own row, which is all the milestone-3 "read own profile only"
-- policy allowed. Nothing on `profiles` is actually sensitive (email and
-- payment data live in auth.users/entitlements, not here), so opening up
-- SELECT is safe; write access is unaffected -- still owner-only for
-- display_name, and role/suspended_at still can't be written by anyone
-- but the service role (see the previous migration's column grants).
create policy "Profiles are publicly readable" on profiles for select to anon, authenticated using (true);
