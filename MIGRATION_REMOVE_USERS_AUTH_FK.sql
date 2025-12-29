-- MIGRATION: Remove foreign key constraint from users.id
-- This allows inserting users regardless of authentication

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Set default for id to auto-generate UUIDs for unauthenticated users
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Now you can insert users with or without authentication.
