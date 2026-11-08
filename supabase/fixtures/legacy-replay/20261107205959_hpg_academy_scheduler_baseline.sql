-- CI ONLY: the live HPG database already has pg_cron in pg_catalog.
-- Install the real extension before the Academy reminder migration so the
-- isolated replay can register and verify its internal notification job.
create extension if not exists pg_cron with schema pg_catalog;
