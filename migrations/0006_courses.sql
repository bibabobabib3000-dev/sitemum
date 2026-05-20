-- RESOUL — courses + drip (PR #9).
--
-- A course is a slug-keyed group of lessons. A user gets an enrollment row
-- when they first open a course they have access to (see
-- src/lib/courses/access.ensureEnrollment). Drip unlock is computed at read
-- time from `enrollment.started_at + lesson.day_offset days <= now()`.
--
-- Homework submissions are append-only — we never delete past attempts.

create table if not exists courses (
  slug            text primary key,
  title_uk        text not null,
  title_ru        text,
  description_uk  text,
  description_ru  text,
  created_at      timestamptz not null default now()
);

create table if not exists lessons (
  id              uuid primary key default gen_random_uuid(),
  course_slug     text not null references courses(slug) on delete cascade,
  slug            text not null,
  day_offset      int  not null,
  title_uk        text not null,
  title_ru        text,
  body_md_uk      text,
  body_md_ru      text,
  video_key       text,
  audio_key       text,
  asset_keys      text[] not null default '{}',
  unique (course_slug, slug)
);

create index if not exists lessons_course_idx
  on lessons (course_slug, day_offset);

create table if not exists enrollments (
  user_id         uuid not null references users(id) on delete cascade,
  course_slug     text not null references courses(slug) on delete cascade,
  started_at      timestamptz not null default now(),
  primary key (user_id, course_slug)
);

create table if not exists homework_submissions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  lesson_id       uuid not null references lessons(id) on delete cascade,
  body_text       text,
  external_url    text,
  file_keys       text[] not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists homework_user_lesson_idx
  on homework_submissions (user_id, lesson_id, created_at desc);

-- Seed: Immersion Week (level-0). 5 уроків з day_offset 0..4.
-- Re-running the migration is safe — ON CONFLICT DO NOTHING.
insert into courses (slug, title_uk, title_ru, description_uk, description_ru)
values (
  'level-0',
  'Immersion Week',
  'Immersion Week',
  '5-денний інтенсив трансформації за RESOUL METHOD v1.0.',
  '5-дневный интенсив трансформации по RESOUL METHOD v1.0.'
)
on conflict (slug) do nothing;

insert into lessons (course_slug, slug, day_offset, title_uk, title_ru, body_md_uk, body_md_ru)
values
  (
    'level-0', 'd1-structure', 0,
    'День 1 · Структура психіки',
    'День 1 · Структура психики',
    E'## Що ми робимо\n\nЗнайомимось зі структурою психіки за RESOUL METHOD v1.0. Розбираємо три шари: автоматизми, актори, ядро.\n\n## Домашнє завдання\n\nЗапиши 3 ситуації за останній тиждень, у яких ти "перемкнувся" у інший стан без власного рішення. Опиши, що було тригером.',
    E'## Что мы делаем\n\nЗнакомимся со структурой психики по RESOUL METHOD v1.0. Разбираем три слоя: автоматизмы, актёры, ядро.\n\n## Домашнее задание\n\nЗапиши 3 ситуации за последнюю неделю, в которых ты "переключился" в другое состояние без своего решения. Опиши, что было триггером.'
  ),
  (
    'level-0', 'd2-body', 1,
    'День 2 · Роль тіла',
    'День 2 · Роль тела',
    E'## Що ми робимо\n\nЯк тіло формує доступ до станів. Базові протоколи: дихання, поза, темп.\n\n## Домашнє завдання\n\nДвічі на день — ранкова й вечірня п''ятихвилинна практика. Зафіксуй стан до і після.',
    E'## Что мы делаем\n\nКак тело формирует доступ к состояниям. Базовые протоколы: дыхание, поза, темп.\n\n## Домашнее задание\n\nДважды в день — утренняя и вечерняя пятиминутная практика. Зафиксируй состояние до и после.'
  ),
  (
    'level-0', 'd3-states', 2,
    'День 3 · Карта станів',
    'День 3 · Карта состояний',
    E'## Що ми робимо\n\nЯк сканувати власні стани й давати їм назви. Інструмент: щоденник станів.\n\n## Домашнє завдання\n\nВпродовж дня зроби 5 коротких записів у щоденнику станів — мінімум 3 з них на роботі або в спілкуванні.',
    E'## Что мы делаем\n\nКак сканировать свои состояния и давать им имена. Инструмент: дневник состояний.\n\n## Домашнее задание\n\nВ течение дня сделай 5 коротких записей в дневнике состояний — минимум 3 из них на работе или в общении.'
  ),
  (
    'level-0', 'd4-actors', 3,
    'День 4 · Внутрішні актори',
    'День 4 · Внутренние актёры',
    E'## Що ми робимо\n\nДіалог з основними внутрішніми голосами. Як їх ідентифікувати й не зливатися з ними.\n\n## Домашнє завдання\n\nНамалюй мапу 3-5 внутрішніх акторів, дай кожному ім''я й коротко опиши, в яких ситуаціях він активний.',
    E'## Что мы делаем\n\nДиалог с основными внутренними голосами. Как их идентифицировать и не сливаться с ними.\n\n## Домашнее задание\n\nНарисуй карту 3-5 внутренних актёров, дай каждому имя и кратко опиши, в каких ситуациях он активен.'
  ),
  (
    'level-0', 'd5-live', 4,
    'День 5 · Жива зустріч',
    'День 5 · Живая встреча',
    E'## Що ми робимо\n\nСпільна синхронізація у Zoom. Розбираємо твої записи, виходимо на план Level 1.\n\n## Домашнє завдання\n\nПриходь з заповненим щоденником і однією-двома ситуаціями, які найбільше зачепили на тижні.',
    E'## Что мы делаем\n\nСовместная синхронизация в Zoom. Разбираем твои записи, выходим на план Level 1.\n\n## Домашнее задание\n\nПриходи с заполненным дневником и одной-двумя ситуациями, которые сильнее всего зацепили на неделе.'
  )
on conflict (course_slug, slug) do nothing;
