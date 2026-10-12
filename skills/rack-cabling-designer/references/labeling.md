# Labeling and identifiers

Use this to design a labeling scheme, set `policy.labelPattern` / `policy.colorByFunction`, read `labels.csv`, and explain RCD-LBL-* findings. Related: [documentation.md](documentation.md), [structured-cabling.md](structured-cabling.md).

## ANSI/TIA-606 concepts (current revision C)

TIA-606 (and the ISO/IEC 14763-2 counterpart) define how to identify and record telecommunications infrastructure. The concepts below are paraphrased; obtain the standard for exact formats. The standard recommends formats but sites may adopt their own consistent scheme.

| Concept | Idea |
|---|---|
| Administration classes 1–4 | Scale of the scheme: class 1 = a single equipment room/space; class 2 = one building with several spaces; class 3 = a campus of several buildings; class 4 = multiple sites. Higher classes add building/site prefixes. |
| Identifiers | Every space, rack/cabinet, patch panel, port, cable, pathway and grounding element gets a unique identifier. |
| Hierarchy | Identifiers are built from the larger item down: site → building → floor/space → rack (often by floor grid coordinates) → panel (by U position or letter) → port. |
| Records | A database or documents linking each identifier to its location, connections and status. Labels and records must agree. |
| Linkage | A cable label tells you where its far end is, so a technician can work from either end. |

## Recommended practical scheme

Keep identifiers short, uppercase, without spaces, stable over time and derived from location, not from what is plugged in (hostnames change).

| Item | Pattern (example) | Example |
|---|---|---|
| Site / room | `<SITE>-<ROOM>` | `DC1-DH1`, `HQ-IDF2` |
| Rack | `<ROW><NN>` or grid coordinate | `A01` (row A, position 01) |
| Panel | `<RACK>-<PANEL>` or `<RACK>-U<NN>` | `A01-FP`, `A01-U40` |
| Panel port | `<PANEL>:<PORT>` | `A01-U40:01` |
| Cable | site prefix + sequence, or from-to | `DC1-0021` or `A01-U40:01/A02-U42:01` |
| Outlet | `<ROOM>-<NN>` + port | `WO-2-01:1` |
| PDU | `<RACK>-PDU-<FEED>` | `A01-PDU-A` |

Sequential cable numbers (`DC1-0021`) are short and stable; the far end is shown by the second label line. From-to labels encode both ends but get long and must be reprinted when moved.

In the model: rack `id`/`name`, device `name` and panel position form the endpoint text; the cable `label` is the cable identifier (falls back to the cable `id`).

## Physical labels

- Label **both ends** of every cable, typically within about 300 mm of the termination (common practice; follow the site standard), visible without unplugging.
- Label panels (front and rear), each port position, racks (top front and rear), PDUs (feed and circuit), and outlets.
- Use durable materials: self-laminating wrap-around labels for cables, flag labels for thin cords, polyester/vinyl rated for the environment; no handwritten paper tags in permanent installations.
- Print from the model's `labels.csv`, not by hand.

## Color coding by function

Colors speed up troubleshooting but never replace labels. Choose a site convention and record it in `policy.colorByFunction`, keyed by cable `function`: `data`, `uplink`, `mgmt`, `console`, `storage`, `crossconnect`, `horizontal`, `backbone`, `other`.

```json
"colorByFunction": { "data": "blue", "uplink": "yellow", "mgmt": "grey", "horizontal": "white" }
```

**RCD-LBL-COLOR** (warning): a cable with that `function` whose `color` differs (case-insensitive) or is missing. Cables without `function`, or functions not in the map, are not checked. Fiber jacket colors often indicate the fiber type (e.g. aqua/violet for OM grades, yellow for single-mode, by common convention); keep functional color coding for copper cords and boots, or use colored labels on fiber.

## policy.labelPattern

A JavaScript regular expression every cable `label` must match (**RCD-LBL-PATTERN**, warning). An invalid regex is an error with the same code.

- It is **not anchored** automatically: `C-\d{3}` also matches `XC-1234`. Use `^…$`.
- In JSON, backslashes are doubled: `"labelPattern": "^DC1-\\d{4}$"`.
- Matching is case-sensitive unless the pattern allows both cases.
- Removed cables (`status: "remove"`) are skipped.

| Pattern (JSON) | Accepts | Rejects |
|---|---|---|
| `"^C-\\d{3}$"` | `C-001` | `C-1`, `c-001`, `C-0001` |
| `"^DC1-\\d{4}$"` | `DC1-0021` | `DC1-21` |
| `"^[A-Z]\\d{2}-U\\d{2}:\\d{2}$"` | `A01-U40:01` | `A1-U40:1` |

Other findings: **RCD-LBL-MISSING** (warning: cable without `label`; sheets fall back to the cable id), **RCD-LBL-DUP** (error: two cables with the same label, compared case-insensitively after trimming spaces).

## labels.csv

Two rows per cable (one per end), in channel order. Columns:

| Column | Content |
|---|---|
| Cable | Cable `id` |
| End | `A` or `B` — follows the traced channel direction (start → end), which can differ from the cable's own `a`/`b` in the model |
| Line 1 | Cable `label` (or `id` if missing) |
| Line 2 | `to <far end>` |
| Attach at | Where this label goes: `<rack name>.U<NN>:<device name>:<port>` plus `(rear)` for panel/outlet rear; unracked items use their `location` |

Example (from `../examples/small-office.rack.json`):

```csv
Cable,End,Line 1,Line 2,Attach at
p1,A,C-011,to IDF2-R1.U22:PP-A:1,IDF2-R1.U20:SW-ACC-01:Gi1/0/1
p1,B,C-011,to IDF2-R1.U20:SW-ACC-01:Gi1/0/1,IDF2-R1.U22:PP-A:1
h1,A,C-001,to WA-2:WO-2-01:1(rear),IDF2-R1.U22:PP-A:1(rear)
h1,B,C-001,to IDF2-R1.U22:PP-A:1(rear),WA-2:WO-2-01:1(rear)
```

## Common mistakes

- Labels based on hostnames or VLANs (they change; locations do not).
- Unanchored `labelPattern` that lets bad labels pass.
- Reusing a label number after a cable is removed while old records still mention it.
- Labeling only one end, or placing the label where the boot hides it.
- Relying on color alone.
