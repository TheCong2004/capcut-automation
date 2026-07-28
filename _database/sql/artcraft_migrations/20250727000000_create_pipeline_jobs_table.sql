-- noinspection SqlDialectInspectionForFile
--
-- NB: This version needs to be bumped even if just adding or changing comments!
--  Failure to do so will cause Windows to segfault at start. (This is horrible!)
--
-- NB: `app_state_dir.rs` contains the file version number.
--
-- Migration history:
--   pipeline_jobs_v1.sqlite - initial version
--     End-to-end short-film pipeline orchestrator jobs. Each row is one
--     multi-stage job driven by the pipeline worker thread. Distinct from
--     the `tasks` table (single-asset generation), which has different
--     status/stage semantics.

CREATE TABLE pipeline_jobs (
    -- Pipeline job primary key (PipelineJobId string token).
    id TEXT NOT NULL PRIMARY KEY,

    -- TaskStatus enum (reused).
    -- e.g. pending, started, complete_success, complete_failure, etc.
    status TEXT NOT NULL,

    -- PipelineStage enum.
    -- Which stage the worker will run (or is running) next.
    -- e.g. script_generation, video_assembly, done.
    current_stage TEXT NOT NULL,

    -- OPTIONAL.
    -- Opaque JSON payload set at enqueue time (e.g. the idea/prompt to
    -- drive script generation).
    input_payload TEXT,

    -- OPTIONAL.
    -- Opaque JSON accumulating each stage's output (e.g. the generated
    -- script, the rendered video URL). Read by later stages as input.
    stage_outputs TEXT,

    -- OPTIONAL.
    -- A human-readable message describing the failure reason.
    on_failure_message TEXT,

    created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
    completed_at INTEGER DEFAULT NULL
);

-- Indices
CREATE INDEX idx_pipeline_jobs_on_status ON pipeline_jobs(status);
CREATE INDEX idx_pipeline_jobs_on_current_stage ON pipeline_jobs(current_stage);
