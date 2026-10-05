CREATE TABLE IF NOT EXISTS codemaster_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(24) NOT NULL,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'user',
    avatar TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS codemaster_users_username_unique
ON codemaster_users(username);

CREATE UNIQUE INDEX IF NOT EXISTS codemaster_users_email_unique
ON codemaster_users(email);


CREATE TABLE IF NOT EXISTS codemaster_problems (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(200) NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    difficulty VARCHAR(12) NOT NULL,
    topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    constraints JSONB NOT NULL DEFAULT '[]'::JSONB,
    examples JSONB NOT NULL DEFAULT '[]'::JSONB,
    starter_code JSONB NOT NULL DEFAULT '{}'::JSONB,
    supported_languages TEXT[] NOT NULL DEFAULT ARRAY['javascript','python','java','cpp']::TEXT[],
    test_cases JSONB NOT NULL DEFAULT '[]'::JSONB,
    hidden_test_cases JSONB NOT NULL DEFAULT '[]'::JSONB,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER REFERENCES codemaster_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS codemaster_problems_slug_unique
ON codemaster_problems(slug);

CREATE INDEX IF NOT EXISTS codemaster_problems_difficulty_idx
ON codemaster_problems(difficulty);

CREATE INDEX IF NOT EXISTS codemaster_problems_active_idx
ON codemaster_problems(active);


CREATE TABLE IF NOT EXISTS codemaster_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES codemaster_users(id) ON DELETE CASCADE,
    problem_id INTEGER NOT NULL REFERENCES codemaster_problems(id) ON DELETE CASCADE,
    language VARCHAR(16) NOT NULL,
    code TEXT NOT NULL,
    status VARCHAR(40) NOT NULL,
    runtime INTEGER,
    memory INTEGER,
    test_cases_passed INTEGER NOT NULL DEFAULT 0,
    total_test_cases INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS codemaster_submissions_user_date_idx
ON codemaster_submissions(user_id, submitted_at);

CREATE INDEX IF NOT EXISTS codemaster_submissions_problem_status_idx
ON codemaster_submissions(problem_id, status);