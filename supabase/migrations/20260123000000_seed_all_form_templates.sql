-- Historical migration marker.
--
-- The original version of this migration contained malformed JSON delimiters
-- in several opening form templates, which prevented a clean migration replay.
-- The complete intended form catalog is preserved by the idempotent repaired
-- seed migrations beginning at 20260710054200.
--
-- Production environments that already applied the historical migration are
-- not altered by this marker. Fresh databases receive the forms from the
-- repaired seed migrations.

select 1;
