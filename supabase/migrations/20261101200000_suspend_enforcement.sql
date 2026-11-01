-- Enforces profiles.suspended_at (added in the club migration, for the
-- admin panel's "suspend member" tool, §3.9) where it actually matters:
-- a suspended member can still read chat/Q&A history, but can't post new
-- messages or questions. Without this, "suspend" would just be a column
-- with no effect.
drop policy "Club members can post in the current month's chat" on chat_messages;
create policy "Club members can post in the current month's chat" on chat_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from profiles where profiles.id = auth.uid() and profiles.suspended_at is not null)
    and exists (
      select 1 from club_months
      where club_months.id = chat_messages.club_month_id
        and club_months.month = date_trunc('month', now())::date
    )
    and exists (
      select 1 from entitlements
      where entitlements.user_id = auth.uid()
        and entitlements.kind = 'club_month'
        and entitlements.ref_id = chat_messages.club_month_id
    )
  );

drop policy "Club members can ask questions in the current month" on questions;
create policy "Club members can ask questions in the current month" on questions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from profiles where profiles.id = auth.uid() and profiles.suspended_at is not null)
    and exists (
      select 1 from club_months
      where club_months.id = questions.club_month_id
        and club_months.month = date_trunc('month', now())::date
    )
    and exists (
      select 1 from entitlements
      where entitlements.user_id = auth.uid()
        and entitlements.kind = 'club_month'
        and entitlements.ref_id = questions.club_month_id
    )
  );
