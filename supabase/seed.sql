-- Seed data for local development (POC: Russian content + TTS).
-- SPEC.md: content language is Russian. Titles/descriptions/transcripts
-- translated/adapted from the English prototype demo catalog for this
-- proof of concept. Still placeholder content -- Liliya writes the real
-- catalog through the admin panel (milestone 5).
--
-- Audio files are NOT created by this script: run
-- `node supabase/seed/generate-audio.mjs` after `supabase db reset` to
-- synthesize and upload Russian spoken-word audio for every episode
-- (uses macOS's built-in `say` with the ru_RU "Milena" voice, local dev only).

with title_casablanca as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'Касабланка', 'Майкл Кёртиц', 1942, 'Драма', '4 эпизода аудиокомментария.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_casablanca.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_casablanca, (values
  (1, 'Кафе, полное изгнанников', 720, '[{"text":"Начните с толпы. Почти каждый эпизодический персонаж в «Рике» был настоящим европейским изгнанником, и их лица придают кафе вес, который не смог бы придумать ни один художник по декорациям.","start_s":0,"end_s":240},{"text":"Когда зал поёт «Марсельезу» под взглядами немецких офицеров, слёзы на экране не сыграны. Эта сцена говорит о том, о чём на самом деле фильм, ещё до того как начинается романтическая линия.","start_s":240,"end_s":480},{"text":"Обратите внимание, как камера движется по «Рику», словно гость, ищущий свободный столик. Мы узнаём правила этого места, проходя через него.","start_s":480,"end_s":720}]'),
  (2, 'Роль Рика', 780, '[{"text":"Богарт играет Рика как человека, разыгрывающего равнодушие, и фильм позволяет нам увидеть, как эта маска трескается.","start_s":0,"end_s":260},{"text":"Знаменитая фраза о том, что он ни за кого не станет рисковать шеей, — это поза. Понаблюдайте за его руками и тем, как он пьёт в сценах воспоминаний, и вы поймёте, что эта поза защищает.","start_s":260,"end_s":520},{"text":"Спросите себя, где вы построили собственного «Рика»: роль, которая держит людей на расстоянии, потому что кто-то однажды оставил вас на платформе.","start_s":520,"end_s":780}]'),
  (3, 'Невозможный выбор Ильзы', 840, '[{"text":"Бергман, по её собственным словам, не знала, кого выберет Ильза. Она играет обе возможности одновременно, и именно поэтому её сцены до сих пор живы.","start_s":0,"end_s":420},{"text":"Ильзу часто читают как пассивную героиню. Взгляните ещё раз: каждый значимый поворот сюжета происходит потому, что она входит в комнату и отказывается оставить всё как было.","start_s":420,"end_s":840}]'),
  (4, 'Финал, которого никто не планировал', 900, '[{"text":"Сценаристы спорили до последних дней съёмок. Найденный ими финал превращает историю любви в историю долга.","start_s":0,"end_s":450},{"text":"Рик не теряет Ильзу в аэропорту. Он выбирает нечто большее, чем они оба, и фильм позволяет ему быть счастливым от этого выбора.","start_s":450,"end_s":900}]')
) as v(position, name, duration_s, transcript);

with title_metropolis as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'Метрополис', 'Фриц Ланг', 1927, 'Научная фантастика', '3 эпизода аудиокомментария.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_metropolis.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_metropolis, (values
  (1, 'Голова, руки и сердце', 660, '[{"text":"История о посреднике между мыслителями и рабочими почти наивна. Архитектура — нет.","start_s":0,"end_s":330},{"text":"Каждый кадр выстроен как фасад собора, а толпа движется как геометрия, прежде чем начать двигаться как люди.","start_s":330,"end_s":660}]'),
  (2, 'Две Марии', 720, '[{"text":"Двойная роль Бригитты Хельм держит на себе вторую половину фильма. В образе доброй Марии она сама безмятежность.","start_s":0,"end_s":360},{"text":"В образе механического двойника она дёргается и усмехается так, как не рискнул бы ни один актёр того времени.","start_s":360,"end_s":720}]'),
  (3, 'Потоп', 600, '[{"text":"Дети, тянущиеся к единственной поднятой руке, — одна из величайших сцен немого кино.","start_s":0,"end_s":300},{"text":"Посмотрите реставрацию 2010 года: она возвращает большую часть утраченных кадров и делает финал по-настоящему заслуженным.","start_s":300,"end_s":600}]')
) as v(position, name, duration_s, transcript);

with title_nosferatu as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'Носферату', 'Ф. В. Мурнау', 1922, 'Ужасы', '2 эпизода аудиокомментария.', true, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_nosferatu.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_nosferatu, (values
  (1, 'Чума с лицом', 600, '[{"text":"Мурнау снимал своего вампира на настоящих улицах, и именно поэтому граф Орлок до сих пор пугает: он принадлежит тому миру, в котором мы живём.","start_s":0,"end_s":300},{"text":"Орлок не столько соблазнитель, сколько чума. Он входит в комнаты через тени раньше, чем входит в них телом.","start_s":300,"end_s":600}]'),
  (2, 'Логика лихорадочного сна', 540, '[{"text":"Драматургия здесь тонка, а интертитры спешат. Но плотоядные растения и корабль с гробами придают фильму логику сна, которую более аккуратный сценарий бы потерял.","start_s":0,"end_s":540}]')
) as v(position, name, duration_s, transcript);

with title_the_general as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'Генерал', 'Бастер Китон', 1926, 'Комедия', '2 эпизода аудиокомментария.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_the_general.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_the_general, (values
  (1, 'Погоня, как в зеркале', 600, '[{"text":"Фильм ведёт погоню на север, затем на юг, и каждая шутка первой половины находит отражение во второй.","start_s":0,"end_s":300},{"text":"Стоит заметить эту структуру, и фильм становится ещё смешнее.","start_s":300,"end_s":600}]'),
  (2, 'Каменное лицо', 540, '[{"text":"Китон никогда не просит сочувствия. Джонни Грей упорен, находчив и безмятежен, даже сидя на шатуне движущегося локомотива.","start_s":0,"end_s":540}]')
) as v(position, name, duration_s, transcript);

with title_sherlock_jr as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'Шерлок младший', 'Бастер Китон', 1924, 'Комедия', 'Один эпизод аудиокомментария.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_sherlock_jr.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_sherlock_jr, (values
  (1, 'Шаг в экран', 600, '[{"text":"Монтаж меняет мир вокруг Китона: из сада на улицу, со скалы в клетку льва — киноязык, превращённый в слэпстик.","start_s":0,"end_s":300},{"text":"Это было достигнуто с помощью теодолита и точных измерений, и до сих пор выглядит безупречно.","start_s":300,"end_s":600}]')
) as v(position, name, duration_s, transcript);

with title_tell_tale as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('story', 'Сердце-обличитель', 'Эдгар Аллан По', 1843, 'Готика', '2 эпизода аудиокомментария.', true, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_tell_tale.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_tell_tale, (values
  (1, 'Я не безумен', 480, '[{"text":"Рассказчик настаивает, что он в своём уме, и каждое его предложение доказывает обратное.","start_s":0,"end_s":240},{"text":"По пишет короткими, задыхающимися фразами, чтобы пульс читателя ускорялся вместе с пульсом рассказчика.","start_s":240,"end_s":480}]'),
  (2, 'Под половицами', 420, '[{"text":"К тому моменту, когда начинается стук, мы тоже его слышим. Прочтите финал вслух — рассказ был написан для исполнения.","start_s":0,"end_s":420}]')
) as v(position, name, duration_s, transcript);

with title_yellow_wallpaper as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('story', 'Жёлтые обои', 'Шарлотта Перкинс Гилман', 1892, 'Психологическая', '3 эпизода аудиокомментария.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_yellow_wallpaper.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_yellow_wallpaper, (values
  (1, 'Запретный дневник', 540, '[{"text":"Каждая запись — акт неповиновения, который мы читаем через её плечо.","start_s":0,"end_s":540}]'),
  (2, 'Узор', 600, '[{"text":"Обои перестраиваются в решётку и фигуру за ней. Гилман никогда не говорит нам, что из этого реально.","start_s":0,"end_s":600}]'),
  (3, 'Добрый муж', 480, '[{"text":"Муж не злодей. Он добр, уверен в себе и катастрофически не прав — а это самый трудный тип человека, которому можно противостоять.","start_s":0,"end_s":480}]')
) as v(position, name, duration_s, transcript);

with title_gift_magi as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('story', 'Дары волхвов', 'О. Генри', 1905, 'Литературная', 'Один эпизод аудиокомментария.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_gift_magi.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_gift_magi, (values
  (1, 'Один доллар восемьдесят семь центов', 540, '[{"text":"О. Генри точно называет, сколько стоит квартира и сколько платят за волосы, поэтому жертва обретает вес. Ирония дешева только если пропустить арифметику.","start_s":0,"end_s":270},{"text":"Это рождественский рассказ, который признаёт, что бедность — это изнурительно.","start_s":270,"end_s":540}]')
) as v(position, name, duration_s, transcript);

-- audio_path/preview_path must be derived from each episode's own id
-- (the inserts above can't self-reference their own generated id across
-- a set-returning VALUES list), so fix them up here.
update episodes set audio_path = id || '/full.m4a', preview_path = id || '/preview.m4a';

with collection_b_silent as (
  insert into collections (name) values ('Мастера немого кино') returning id
)
insert into collection_titles (collection_id, title_id)
select collection_b_silent.id, titles.id from collection_b_silent, titles where titles.title in ('Метрополис', 'Носферату', 'Генерал', 'Шерлок младший');

with collection_b_dark as (
  insert into collections (name) values ('Тёмные истории') returning id
)
insert into collection_titles (collection_id, title_id)
select collection_b_dark.id, titles.id from collection_b_dark, titles where titles.title in ('Сердце-обличитель', 'Жёлтые обои');

