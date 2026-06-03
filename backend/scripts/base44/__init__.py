"""base44 → Orion data migration.

A small, self-contained toolkit that pulls the legacy app's data out of the
base44 REST API and loads it into Orion's Postgres schema. Designed to be run
repeatedly during validation and one final time at cutover.

Pipeline (see the individual modules):

    discover.py   PHASE 0  sample entities -> discovery/SCHEMA_REPORT.md
    extract.py    PHASE 1  pull every entity -> raw/<Entity>.json
    load.py       PHASE 2  wipe + bulk-insert into the target company
    import_base44 orchestrator CLI tying extract -> convert -> load together

`client.py` is the HTTP layer, `settings.py` holds the per-app configuration
(entity list + enum/role maps), and `mappings.py` converts base44 records into
Orion SQLModel rows.
"""
