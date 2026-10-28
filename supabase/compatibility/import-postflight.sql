-- Aggregate-only import reconciliation. No personal field values returned.
BEGIN READ ONLY;
SELECT state,count(*) AS batches,sum(extracted_count) AS source_occurrences,sum(accepted_count) AS accepted,sum(quarantined_count) AS quarantined,sum(excluded_count) AS excluded
 FROM mass_foundation.import_batches GROUP BY state;
SELECT count(*) AS incomplete_reconciliation FROM mass_foundation.import_batches WHERE state='complete' AND (extracted_count<>accepted_count+quarantined_count+excluded_count);
SELECT 'files' AS kind,count(*) FROM mass_foundation.source_files
UNION ALL SELECT 'sheets',count(*) FROM mass_foundation.source_sheets
UNION ALL SELECT 'rows',count(*) FROM mass_foundation.source_rows
UNION ALL SELECT 'exceptions',count(*) FROM mass_foundation.import_exceptions
UNION ALL SELECT 'donors',count(*) FROM mass_core.donors
UNION ALL SELECT 'centres',count(*) FROM mass_core.centres
UNION ALL SELECT 'staff_members',count(*) FROM mass_core.staff_members
UNION ALL SELECT 'staff_assignments',count(*) FROM mass_core.centre_staff_assignments;
SELECT count(*) AS assignments_without_source FROM mass_core.centre_staff_assignments a LEFT JOIN mass_foundation.source_rows r ON r.id=a.source_row_id WHERE r.id IS NULL;
SELECT count(*) AS centres_without_verified_donor FROM mass_core.centres WHERE donor_id IS NULL;
COMMIT;
