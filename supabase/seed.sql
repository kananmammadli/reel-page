-- Seed data for local development (milestone 2).
-- Ported from prototype/reel-and-page.html's demo catalog so local dev
-- visually/structurally matches the UX reference. English placeholder
-- content -- Liliya writes the real Russian catalog through the admin
-- panel (milestone 5).
--
-- Audio files are NOT created by this script: run
-- `node supabase/seed/generate-audio.mjs` after `supabase db reset` to
-- synthesize and upload placeholder spoken-word audio for every episode
-- (uses macOS's built-in `say`/`afconvert`, local dev only).

with title_casablanca as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'Casablanca', 'Michael Curtiz', 1942, 'Drama', '4 episodes of audio commentary.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_casablanca.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_casablanca, (values
  (1, 'A café full of exiles', 720, '[{"text":"Start with the crowd. Nearly every bit player at Rick''s was a real European exile, and their faces give the café a weight no set designer could fake.","start_s":0,"end_s":240},{"text":"When the room sings ''La Marseillaise'' over the German officers, the tears on screen are not acted. That scene tells you what the film is really about before the romance even begins.","start_s":240,"end_s":480},{"text":"Notice how the camera moves through Rick''s like a guest looking for a table. We learn the rules of this place by walking through it.","start_s":480,"end_s":720}]'),
  (2, 'Rick''s performance', 780, '[{"text":"Bogart plays Rick as a man performing indifference, and the film lets us watch the performance crack.","start_s":0,"end_s":260},{"text":"The famous line about sticking his neck out for nobody is a pose. Watch his hands and his drinking in the flashback scenes and you see what the pose is protecting.","start_s":260,"end_s":520},{"text":"Ask yourself where you have built a Rick of your own: a role that keeps people at a distance because someone once left you on a railway platform.","start_s":520,"end_s":780}]'),
  (3, 'Ilsa''s impossible choice', 840, '[{"text":"Bergman famously did not know which man Ilsa would choose. She plays both possibilities at once, which is why her scenes still feel alive.","start_s":0,"end_s":420},{"text":"Ilsa is often read as passive. Look again: every major turn in the plot happens because she walks into a room and refuses to leave it unchanged.","start_s":420,"end_s":840}]'),
  (4, 'The ending nobody planned', 900, '[{"text":"The writers were still arguing on the last days of the shoot. The ending they found turns a love story into a story about duty.","start_s":0,"end_s":450},{"text":"Rick does not lose Ilsa at the airport. He chooses something larger than both of them, and the film lets him be happy about it.","start_s":450,"end_s":900}]')
) as v(position, name, duration_s, transcript);

with title_metropolis as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'Metropolis', 'Fritz Lang', 1927, 'Science fiction', '3 episodes of audio commentary.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_metropolis.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_metropolis, (values
  (1, 'Head, hands and heart', 660, '[{"text":"The story of a mediator between the thinkers and the workers is almost naive. The architecture is not.","start_s":0,"end_s":330},{"text":"Every frame is composed like a cathedral elevation, and the crowds move as geometry before they move as people.","start_s":330,"end_s":660}]'),
  (2, 'Two Marias', 720, '[{"text":"Brigitte Helm''s double performance carries the second half. As the gentle Maria she is all stillness.","start_s":0,"end_s":360},{"text":"As the machine-made double she jerks and leers in ways no actor of the period would have dared.","start_s":360,"end_s":720}]'),
  (3, 'The flood', 600, '[{"text":"Children climbing toward a single raised arm: one of the great set pieces of silent cinema.","start_s":0,"end_s":300},{"text":"Watch the 2010 restoration, which recovers most of the lost footage and makes the ending feel earned.","start_s":300,"end_s":600}]')
) as v(position, name, duration_s, transcript);

with title_nosferatu as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'Nosferatu', 'F. W. Murnau', 1922, 'Horror', '2 episodes of audio commentary.', true, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_nosferatu.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_nosferatu, (values
  (1, 'A plague with a face', 600, '[{"text":"Murnau shot his vampire on real streets, and that is why Count Orlok still frightens: he belongs to the world we live in.","start_s":0,"end_s":300},{"text":"Orlok is less a seducer than a plague. He enters rooms through shadows before he enters them in body.","start_s":300,"end_s":600}]'),
  (2, 'Fever-dream logic', 540, '[{"text":"The drama is thin and the intertitles hurry. But the carnivorous plants and the ship of coffins give the film a dream logic a tidier script would have lost.","start_s":0,"end_s":540}]')
) as v(position, name, duration_s, transcript);

with title_the_general as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'The General', 'Buster Keaton', 1926, 'Comedy', '2 episodes of audio commentary.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_the_general.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_the_general, (values
  (1, 'A chase in a mirror', 600, '[{"text":"The film runs a chase north, then a chase south, and each gag in the first half is answered by its mirror in the second.","start_s":0,"end_s":300},{"text":"Once you notice the structure, the film becomes even funnier.","start_s":300,"end_s":600}]'),
  (2, 'The stone face', 540, '[{"text":"Keaton never asks for sympathy. Johnnie Gray is stubborn, resourceful and serene, even while sitting on the drive rod of a moving engine.","start_s":0,"end_s":540}]')
) as v(position, name, duration_s, transcript);

with title_sherlock_jr as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('film', 'Sherlock Jr.', 'Buster Keaton', 1924, 'Comedy', 'A single episode of audio commentary.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_sherlock_jr.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_sherlock_jr, (values
  (1, 'Walking into the screen', 600, '[{"text":"The edits change the world around Keaton, from garden to street to cliff to lion''s den: film grammar turned into slapstick.","start_s":0,"end_s":300},{"text":"It was achieved with surveyor''s tools and exact measurements, and it still looks seamless.","start_s":300,"end_s":600}]')
) as v(position, name, duration_s, transcript);

with title_tell_tale as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('story', 'The Tell-Tale Heart', 'Edgar Allan Poe', 1843, 'Gothic', '2 episodes of audio commentary.', true, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_tell_tale.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_tell_tale, (values
  (1, 'I am not mad', 480, '[{"text":"The narrator insists he is sane, and every sentence he writes proves otherwise.","start_s":0,"end_s":240},{"text":"Poe writes in short, panting clauses so the reader''s pulse speeds up with the narrator''s.","start_s":240,"end_s":480}]'),
  (2, 'Under the floorboards', 420, '[{"text":"By the time the beating begins, we hear it too. Read the ending aloud; the story was built for performance.","start_s":0,"end_s":420}]')
) as v(position, name, duration_s, transcript);

with title_yellow_wallpaper as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('story', 'The Yellow Wallpaper', 'Charlotte Perkins Gilman', 1892, 'Psychological', '3 episodes of audio commentary.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_yellow_wallpaper.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_yellow_wallpaper, (values
  (1, 'The forbidden journal', 540, '[{"text":"Every entry is an act of rebellion we are reading over her shoulder.","start_s":0,"end_s":540}]'),
  (2, 'The pattern', 600, '[{"text":"The wallpaper reorganizes itself into bars and a figure behind them. Gilman never tells us what is real.","start_s":0,"end_s":600}]'),
  (3, 'The kind husband', 480, '[{"text":"The husband is not a villain. He is kind, confident and catastrophically wrong, which is the hardest kind of person to resist.","start_s":0,"end_s":480}]')
) as v(position, name, duration_s, transcript);

with title_gift_magi as (
  insert into titles (type, title, creator, year, genre, description, is_free, published_at)
  values ('story', 'The Gift of the Magi', 'O. Henry', 1905, 'Literary', 'A single episode of audio commentary.', false, now())
  returning id
)
insert into episodes (id, title_id, position, name, duration_s, audio_path, preview_path, transcript)
select gen_random_uuid(), title_gift_magi.id, v.position, v.name, v.duration_s, gen_random_uuid()::text || '/full.m4a', gen_random_uuid()::text || '/preview.m4a', v.transcript::jsonb
from title_gift_magi, (values
  (1, 'One dollar and eighty-seven cents', 540, '[{"text":"O. Henry tells us exactly what the flat costs and what the hair sells for, so the sacrifice has weight. The irony is cheap only if you skip the arithmetic.","start_s":0,"end_s":270},{"text":"It is a Christmas story that admits poverty is exhausting.","start_s":270,"end_s":540}]')
) as v(position, name, duration_s, transcript);

-- audio_path/preview_path must be derived from each episode's own id
-- (the inserts above can't self-reference their own generated id across
-- a set-returning VALUES list), so fix them up here.
update episodes set audio_path = id || '/full.m4a', preview_path = id || '/preview.m4a';

with collection_b_silent as (
  insert into collections (name) values ('Silent Masters') returning id
)
insert into collection_titles (collection_id, title_id)
select collection_b_silent.id, titles.id from collection_b_silent, titles where titles.title in ('Metropolis', 'Nosferatu', 'The General', 'Sherlock Jr.');

with collection_b_dark as (
  insert into collections (name) values ('Dark Tales') returning id
)
insert into collection_titles (collection_id, title_id)
select collection_b_dark.id, titles.id from collection_b_dark, titles where titles.title in ('The Tell-Tale Heart', 'The Yellow Wallpaper');

