
UPDATE schedule_blocks
SET deleted_at = now()
WHERE id IN (
  '20264f69-a926-4b9c-b697-8d044bad38e4',
  '650b7ad9-ea5e-4308-9dbc-75b203a38463',
  '32f81840-db9b-41ff-973e-7ba16f7ca5a5',
  '871888d7-5c98-4377-9804-2f1f2065f140'
);

INSERT INTO schedule_blocks
  (company_id, technician_id, project_id, job_id, source, start_at, end_at,
   title, match_state, match_confidence, match_reason)
SELECT
  company_id, technician_id, project_id, job_id, 'manual',
  '2026-06-19 06:00:00+00'::timestamptz,
  '2026-06-19 14:00:00+00'::timestamptz,
  title, 'manual', 100, 'Manuell opprydding: flyttet til 19. juni'
FROM schedule_blocks
WHERE id IN (
  'ab614eb9-3c04-4b41-aa7b-8fbe47b21f82',
  '97eeb963-2d23-4f00-b87d-ae29e6f8b6dd'
);
