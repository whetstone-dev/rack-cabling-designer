# Change plan (method of procedure)

Template for cabling, rack or power changes on live infrastructure. Generate the before/after documents from the model; do not edit them by hand. Electrical steps are performed only by qualified, authorized personnel.

| Field | Value |
|---|---|
| Change id / ticket | |
| Title | |
| Site / room / racks | |
| Requested by | |
| Implementer(s) | |
| Reviewer | |
| Service owner(s) approving | |
| Maintenance window (start - end, time zone) | |
| Risk level (low / medium / high) and justification | |

## 1. Scope

What changes and why (one paragraph). What is explicitly out of scope.

- Racks affected:
- Devices added / moved / removed:
- PDUs, circuits or feeds affected:
- Services that depend on the touched ports and power:

## 2. Model revisions

| | File | `meta.revision` | `meta.status` | Validate result (errors / warnings) | Build folder |
|---|---|---|---|---|---|
| Before | | | as-built | | |
| After | | | change | | |

Accepted warnings in the "after" model and why: ______________________

Note: the toolkit has no `diff` command. Build both revisions and compare their `cable-schedule.csv` (version-control diff or spreadsheet compare) to fill the table below.

## 3. Cable changes

| # | Action (add / remove / move / relabel) | Cable id | Label | A end before | A end after | B end before | B end after | Media | Length (m) | Color |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | |
| 2 | | | | | | | | | | |
| 3 | | | | | | | | | | |

## 4. Rack and power changes

| # | Item | Before (rack / U / face, or PDU / outlet / feed) | After | Notes |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

Power check from `power.md` (after): worst failover load per affected PDU vs usable capacity: ______________________

## 5. Prerequisites

- [ ] Change approved; window and freeze periods confirmed.
- [ ] Before model matches the site (spot-checked labels and ports on the racks involved).
- [ ] After model validated; `build` generated; labels printed from `labels.csv`.
- [ ] Material on site and checked against the BOM (cords, optics, labels, blanking panels, power cords).
- [ ] Configuration backups taken; port/VLAN/config changes prepared and reviewed separately.
- [ ] Redundancy verified: both PSUs healthy on different feeds; redundant links up; no active alarms.
- [ ] Monitoring and escalation contacts available; stakeholders notified.
- [ ] Tools: labeler, fiber inspection scope and cleaner, cable tester, PPE, server lift if needed.

## 6. Pre-checks (record results)

| Check | Command / observation | Expected | Result |
|---|---|---|---|
| Interface status of affected ports | | up/up | |
| Error counters baseline | | recorded | |
| Optical receive levels (where available) | | within module spec | |
| PSU and PDU outlet loads | | both PSUs sharing | |
| Monitoring dashboard | | no alarms | |

## 7. Procedure

One action per step. Do one side of a redundant pair, verify, then the other.

| Step | Action | Expected result | Verification | Done (time / initials) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

Rules: identify each cable at both ends (label + `trace`) before unplugging; never remove a power cord before confirming the other PSU carries the load; clean and inspect fiber connectors before mating; label new cables at both ends as installed; refit blanking panels.

## 8. Rollback

Go/no-go decision point: ______ (time or step number). Who decides: ______________

| Step | Rollback action | Verification |
|---|---|---|
| R1 | | |
| R2 | | |
| R3 | | |

## 9. Post-checks

| Check | Expected | Result |
|---|---|---|
| Interface status and error counters | up, no new errors | |
| Optical levels | within module spec | |
| Redundancy restored (both links, both PSUs on different feeds) | yes | |
| Power: PDU loads vs `power.md` after-revision figures | within budget | |
| Labels at both ends match `labels.csv` | yes | |
| Blanking panels and doors refitted, pathways tidy, removed cable taken out | yes | |
| Monitoring green for the agreed observation period | yes | |

## 10. Communication

| When | Audience | Channel | Message |
|---|---|---|---|
| Before start | | | |
| On completion or rollback | | | |
| If escalation needed | | | |

## 11. Close-out

- [ ] Model updated to what was actually done (OBSERVED), `meta.status: "as-built"`, revision incremented, rebuilt and archived.
- [ ] Deviations from the plan recorded below.
- [ ] Test results attached (certification, fiber tests) where new links were installed.
- [ ] Ticket closed.

Deviations: ______________________

## 12. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Implementer | | | |
| Reviewer | | | |
| Service owner | | | |
