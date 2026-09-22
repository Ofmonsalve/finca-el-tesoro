-- Optimistic concurrency for farm book sync (F-10 / P0).
-- Clients must supply the version they last read; stale writes are rejected.
alter table farm_books
  add column version integer not null default 1;
