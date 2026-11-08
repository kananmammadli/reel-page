# Store listing reference — Reel & Page

A draft for App Store Connect / Google Play Console, grounded in what the app actually collects and does (per `SPEC.md`). Not a legal document — the privacy-label audit below should be re-checked against the final build before submission, and screenshots/final copy need a real device/simulator to capture (none was available in this environment).

## App name and subtitle

- **Name:** Reel & Page
- **Subtitle / short description:** Аудиокомментарии к фильмам и рассказам
- **Category:** Entertainment (primary), Education or Books (secondary, if the store allows two)

## Description (Russian — matches the app's content language)

> **Reel & Page — голос одного критика, который смотрит фильмы и читает рассказы вместе с вами.**
>
> Слушайте авторские аудиокомментарии к классическим фильмам и короткой прозе — эпизод за эпизодом, с расшифровкой
> текста на экране. Начните бесплатно: каждая платная запись открыта первые 5 минут.
>
> — Слушайте в фоне, с управлением с экрана блокировки
> — Продолжайте с того места, где остановились, на любом устройстве
> — Сохраняйте любимые строки в личный дневник цитат
> — Присоединяйтесь к клубу: один фильм в месяц, чат с другими слушателями и сессия вопросов ведущей
> — Покупайте отдельные записи или сборники навсегда — без скрытых платежей за уже купленное
>
> Аккаунт нужен только для покупок, клуба и синхронизации — каталог открыт без регистрации.

## Keywords

аудиокнига, кинокритика, подкаст о кино, аудиокомментарий, короткая проза, клуб книголюбов, аудиогид фильм

## App Store "App Privacy" questionnaire — data-type audit

Cross-checked against `SPEC.md` §4/§5 and what the schema/code actually stores. Fill in Apple's questionnaire from this table, not from memory.

| Apple data type | Collected? | Notes |
|---|---|---|
| Email address | Yes | OTP sign-in; used for account, not shared, not used for tracking |
| Name | Yes (optional) | `profiles.display_name`, shown in club chat only |
| User ID | Yes | Supabase auth user id; used for app functionality |
| Purchase history | Yes | `entitlements`/`subscriptions`/`payments` — which titles/collections/club months were bought, and amounts; used for app functionality, not shared for advertising |
| Other user content | Yes | Club chat messages, Q&A questions, saved quotes (`chat_messages`, `questions`, `quotes`) |
| Product interaction | Yes | Playback position, listening minutes per day (`playback_positions`, `listening_days`) — used for app functionality (resume, stats), not analytics/advertising |
| Precise/coarse location | No | Never requested |
| Contacts | No | Never requested |
| Browsing/search history | No | In-app search isn't sent anywhere beyond the query itself |
| Financial info (card/bank) | No | Stripe and RevenueCat/App Store/Google Play handle payment details directly; this app never sees or stores a card number |
| Device ID / push token | Yes (opt-in only) | Only stored if the user explicitly turns on club notifications in Profile (`push_tokens`) |
| Diagnostics / crash data | No | No crash-reporting SDK is integrated yet — revisit this row if one is added later |
| Advertising data | No | No ad SDK, no cross-app tracking |

**Linked to identity:** email, display name, purchase history, user content, and product interaction are all linked to the account. Push tokens are linked only while notifications are enabled.

**Used for tracking (Apple's specific definition — linking data across apps/sites owned by other companies for advertising):** none. Flag "No, we do not track" when asked.

## Google Play "Data safety" section

Same underlying facts as the table above, in Play's categories: **Personal info** (email, optional display name) — collected, not shared, required for account functionality; **Financial info** — not collected (handled by billing providers); **App activity** (purchase history, playback progress, in-app messages) — collected, not shared, used for app functionality; **Device or other identifiers** (push token) — collected only if notifications are enabled, not shared. Data is encrypted in transit (Supabase/Stripe/RevenueCat all serve over TLS). A deletion request can be made via the in-app "Delete account" action, which the Play Console form can link to directly.

## Required store-policy features (already built, not just declared)

- ✅ Restore purchases button (Profile, both platforms)
- ✅ Account deletion (Profile, both platforms — cascades to all user data)
- ✅ Subscription terms shown before purchase (club price/renewal terms on the checkout screen, once a real price exists)
- ✅ Chat moderation: report, block, host pin/delete/suspend

## Not included here (needs a real account to produce)

Screenshots, app preview video, and App Store Connect's exact "What's New" release-notes text all need a running simulator/device and a signed build, neither of which exists in this environment. The copy above is ready to pair with screenshots once those exist.
