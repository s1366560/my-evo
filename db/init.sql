-- db/init.sql
-- This file is executed by PostgreSQL docker-entrypoint-initdb.d on first container start.
-- Schema is created via Prisma db push (see backend Dockerfile CMD).

-- Grant evomap user access
-- Note: user/db are created automatically by postgres image with POSTGRES_USER/POSTGRES_DB env vars.
-- No additional setup needed here since Prisma handles all schema creation.
