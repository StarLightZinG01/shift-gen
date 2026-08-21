UPDATE ga_violations AS violation
SET
  constraint_code = 'forbidden_sequence',
  severity = 'error',
  message = 'ลำดับเวรต้องห้าม บ → ด'
FROM ga_runs AS run
WHERE violation.ga_run_id = run.id
  AND violation.constraint_code = 'evening_to_night'
  AND COALESCE(
    (run.settings_snapshot->'worker_score_debug'->'hard_violation_details'->>'forbidden_sequence')::numeric,
    0
  ) > 0
  AND run.input_snapshot @> '{"rule_engine":{"hard":{"forbidden_sequences":[["บ","ด"]]}}}'::jsonb;
