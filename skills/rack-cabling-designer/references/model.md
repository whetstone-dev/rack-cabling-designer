# The `*.rack.json` model (modelVersion 1)

One JSON file describes racks, equipment, power and cabling of a site. Every output is generated from it. Schema: [`../assets/schema/rack-model.schema.json`](../assets/schema/rack-model.schema.json) (unknown fields are errors, so typos are caught). Start from `rackcab init <file>` or an example in [`../examples/`](../examples/).

Units are fixed: **metres, kilograms, watts, volts, amperes, millimetres for depth**. Convert imperial inputs before writing the model.

## Top level

| Field | Required | Content |
|---|---|---|
| `modelVersion` | yes | Always `1` |
| `meta` | yes | `name` (required), `description`, `site`, `revision`, `status` (`design` · `as-built` · `change`), `author`, `language` |
| `policy` | no | Rules tuning, see below |
| `locations[]` | no | Sites, rooms, rows, work areas |
| `racks[]` | yes | Racks and cabinets |
| `equipmentTypes[]` | no | Datasheet-level definitions; override catalog ids with the same `id` |
| `devices[]` | yes | Installed or planned equipment instances |
| `pdus[]` | no | Power distribution units |
| `powerLinks[]` | no | Device inlet → PDU outlet |
| `cables[]` | no | Every data cable, cord and installed link |

Ids: letters, digits, `.`, `_`, `-`, up to 64 characters. Racks, devices and PDUs share one namespace.

## policy

| Field | Default | Effect |
|---|---|---|
| `powerDerating` | 0.8 | Usable fraction of circuit capacity ([power.md](power.md)) |
| `powerBasis` | `max` | Use equipment `maxW` (`typical` uses `typicalW`) |
| `requireRedundantPower` | false | Single-fed devices and single-feed sites become warnings |
| `requireBlankingPanels` | false | Open cold-face units become warnings instead of info |
| `maxRackUtilization` | none | Fraction of front units that may be used (growth reserve) |
| `labelPattern` | none | Regular expression every cable label must match |
| `colorByFunction` | none | `{ "uplink": "yellow" }`: cables with that `function` must have that `color` |
| `cableSlackPercent` | 10 | Added to installed-link lengths in the BOM |
| `stockLengthsM` | 0.5 … 50 | Cord lengths the BOM rounds up to |

## locations[]

`{ "id", "kind": "site|building|floor|room|row|cage|work-area", "name", "parent", "notes" }`. Racks and unracked devices (wall outlets) point to a location.

## racks[]

| Field | Notes |
|---|---|
| `id`, `name` | |
| `heightU` | 1–60 |
| `widthIn` | 19 or 23 |
| `depthMm` | Inner mounting depth; enables depth checks |
| `posts` | 2 or 4 |
| `maxLoadKg` | Rated static load; enables weight checks |
| `frontAisle` | `cold` (default), `hot`, or `none` (wall cabinet, no aisle containment: airflow checks skipped) |
| `location`, `notes` | |

## equipmentTypes[]

| Field | Notes |
|---|---|
| `id`, `manufacturer`, `model` | |
| `category` | `switch`, `router`, `firewall`, `server`, `storage`, `patch-panel`, `outlet`, `cable-manager`, `blanking`, `shelf`, `ups`, `kvm`, `other` |
| `heightU` | 0 for wall outlets and other non-rack items |
| `fullDepth` | Occupies the unit on both faces. Default `true`, except patch panels, outlets, cable managers, blanking panels and shelves |
| `depthMm`, `weightKg` | From the datasheet |
| `airflow` | Relative to **this type's front**: `front-to-back`, `back-to-front`, `side-to-side`, `passive` |
| `power` | `{ "typicalW", "maxW", "inlets": [{ "id": "PSU1", "connector": "C14" }] }` |
| `ports[]` | `{ "name", "connector", "rearConnector", "speed", "role" }` |

**Front convention:** for network equipment the type's front is the **port side**. A switch whose ports face the rear of the rack is a device with `"face": "rear"`. Choose `airflow` accordingly: "port-side intake" = `front-to-back`, "port-side exhaust" = `back-to-front`.

**Port names** expand numeric ranges: `"Gi1/0/{1-48}"` → `Gi1/0/1` … `Gi1/0/48`. Connectors: `rj45`, `lc-duplex`, `sc-duplex`, `mpo-12`, `mpo-24`, `sfp`, `sfp+`, `sfp28`, `qsfp+`, `qsfp28`, `punchdown`. Speeds: `100M`, `1G`, `2.5G`, `5G`, `10G`, `25G`, `40G`, `100G`.

**Patch panels and outlets** (categories `patch-panel`, `outlet`) are passive: port N has a front and a rear, internally connected. `rearConnector` describes the rear (e.g. `punchdown`); without it the rear matches the front.

Run `rackcab catalog` for generic types (`generic-switch-48-1g-4sfpp`, `generic-server-1u`, `generic-patch-panel-24-rj45`, …). They are placeholders for early design; replace them with datasheet-based types before procurement.

## devices[]

| Field | Notes |
|---|---|
| `id`, `name` | `name` is what drawings and labels show |
| `type` | An `equipmentTypes` id or a catalog id |
| `rack`, `position` | `position` = **lowest** unit occupied; U1 is at the bottom |
| `face` | Rack face the equipment front looks at (`front` default) |
| `location` | For unracked items |
| `role`, `netRef` | `netRef` = device id in a network-engineering `*.net.json` model |
| `status` | `planned` (default), `existing`, `remove` |

A 2U device at `position: 10` occupies U10–U11.

`status: remove` marks equipment that a change will take out: it still occupies its units, weight and power (it is there until the change is done) but is left out of the BOM. For the after-state, delete it from a copy of the model (keep one model per revision). The same applies to cables with `status: remove`.

## pdus[]

| Field | Notes |
|---|---|
| `id`, `name`, `rack` | |
| `feed` | Power source label (`A`, `B`, …). Failover analysis removes one feed at a time |
| `circuit` | Upstream panel/breaker reference for documentation |
| `mounting` | `0U-left`, `0U-right` (side channels, no units) or `rack` (needs `position`, `heightU`, `face`) |
| `voltage`, `maxAmps`, `phases` | Capacity = V × A (single phase) or √3 × V × A (three phase, line-to-line voltage) |
| `outlets[]` | `[{ "connector": "C13", "count": 36 }, { "connector": "C19", "count": 6 }]`, numbered consecutively from 1 (here C13 = 1–36, C19 = 37–42) |
| `weightKg` | Included in rack weight |

## powerLinks[]

`{ "device": "srv01", "inlet": "PSU1", "pdu": "a01-pdu-a", "outlet": 3 }`. One link per inlet; one inlet per outlet.

## cables[]

| Field | Notes |
|---|---|
| `id` | Unique |
| `label` | Printed identifier; checked for uniqueness and `policy.labelPattern` |
| `a`, `b` | `{ "device", "port", "side" }`; `side` (`front`/`rear`) only for panels and outlets |
| `media` | `cat5e`, `cat6`, `cat6a`, `cat8`, `om1`–`om5`, `os2`, `dac`, `aoc` |
| `lengthM` | Needed for reach checks and BOM sizing |
| `color`, `function` | `function`: `data`, `uplink`, `mgmt`, `console`, `storage`, `crossconnect`, `horizontal`, `backbone`, `other` |
| `pathway`, `status`, `notes` | |

### Channels

The toolkit chains cables through passive panels into **channels**. Example: switch port → cord → panel 3 front | panel 3 rear → installed cable → outlet 1 rear | outlet front. A cable between two rears is an installed **permanent link**; every other cable is a **cord**. Reach is checked on the whole channel with the slowest active-port speed and the lowest-grade media. A channel that stops at a panel or outlet with nothing patched is reported as *open*, which is normal for spare outlets.

Breakout cables (one QSFP to four SFP) are not modeled; model them as separate cables per lane group and note the breakout.

## Rule codes

| Family | Codes |
|---|---|
| Schema and identity | `RCD-SCHEMA`, `RCD-DUP-ID`, `RCD-REF` |
| Rack | `RCD-RACK-POSITION`, `RCD-RACK-BOUNDS`, `RCD-RACK-OVERLAP`, `RCD-RACK-DEPTH`, `RCD-RACK-WEIGHT`, `RCD-RACK-UTIL`, `RCD-RACK-2POST` |
| Airflow | `RCD-AIR-RECIRC`, `RCD-AIR-SIDE`, `RCD-AIR-BLANKING`, `RCD-AIR-DATA` |
| Power | `RCD-PWR-OUTLET`, `RCD-PWR-INLET`, `RCD-PWR-CONNECTOR`, `RCD-PWR-RACK`, `RCD-PWR-DATA`, `RCD-PWR-UNPOWERED`, `RCD-PWR-REDUNDANCY`, `RCD-PWR-CAPACITY`, `RCD-PWR-FAILOVER` |
| Cabling | `RCD-CBL-SELF`, `RCD-CBL-SIDE`, `RCD-CBL-PORT`, `RCD-CBL-PORT-REUSE`, `RCD-CBL-MEDIA`, `RCD-CBL-LENGTH-MISSING`, `RCD-CBL-MIXED`, `RCD-CBL-SPEED`, `RCD-CBL-REACH`, `RCD-CBL-CHANNEL`, `RCD-CBL-OPTIC` |
| Labels | `RCD-LBL-MISSING`, `RCD-LBL-DUP`, `RCD-LBL-PATTERN`, `RCD-LBL-COLOR` |

Schema errors stop the domain rules: fix them first. `validate --json` returns the same findings with their model paths (e.g. `cables[4].b.port`).
