-- RETIRED by permission Phase 8.
--
-- This operator path wrote user_scope_grants and staff_operational_access. Both
-- are retained only as historical evidence and are no longer authorization
-- inputs. Use the protected Leadership administration workflow for accounts,
-- roles and centre assignments. New verified visit-directory links require a
-- separately reviewed governed operator workflow.
DO $$
BEGIN
 RAISE EXCEPTION USING ERRCODE='55000',
  MESSAGE='clone-operational-access is retired; use Leadership administration';
END;
$$;
