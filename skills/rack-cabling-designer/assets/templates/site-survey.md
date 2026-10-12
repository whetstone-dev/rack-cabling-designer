# Site survey and requirements

Fill in what is known; write `unknown` or `TBC` instead of guessing. Each section maps to fields of the `*.rack.json` model (in brackets). Mark values as OBSERVED (seen on site / measured), DATASHEET, or ESTIMATE.

Project: ______________________  Revision: ____  Date: __________  Surveyed by: ______________

## 1. Site and rooms  [`meta`, `locations`]

| Field | Value |
|---|---|
| Site name / address (internal reference only) | |
| Building / floor | |
| Room name and type (MDF/ER, IDF/TR, data hall, entrance room, closet) | |
| Design, as-built survey, or change to existing? [`meta.status`] | design / as-built / change |
| Floor type (slab, raised floor) and floor load limit | |
| Room dimensions, door width/height, route for delivering racks | |
| Access control, working hours, escort requirements | |

## 2. Racks  [`racks`]

| Rack id | Name | Room/row | Height (U) | Width (19/23 in) | Usable depth (mm) | Posts (2/4) | Static / dynamic load (kg) | Front faces (cold/hot/none) | New or existing |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |
| | | | | | | | | | |

Notes (doors, side panels, cable entry top/bottom, 0U PDU channels, earthing bar): ______________________

## 3. Equipment list  [`equipmentTypes`, `devices`]

One row per model of equipment (type), then one row per installed unit (device). Attach datasheets.

### 3a. Equipment types (from datasheets)

| Type id | Manufacturer | Model | Category | Height (U) | Full depth? | Depth (mm) | Weight (kg) | Airflow (front-to-back / back-to-front / side-to-side / passive) | Typical W | Max W | Inlets (id + connector, e.g. PSU1 C14) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | |
| | | | | | | | | | | | |

Category: switch, router, firewall, server, storage, patch-panel, outlet, cable-manager, blanking, shelf, ups, kvm, other. For network gear, state which side the datasheet calls "front" (usually the port side) and which airflow option will be ordered.

### 3b. Ports per type

| Type id | Port names (ranges like `Gi1/0/{1-48}`) | Connector (rj45, lc-duplex, sc-duplex, mpo-12, mpo-24, sfp, sfp+, sfp28, qsfp+, qsfp28, punchdown) | Rear connector (panels/outlets) | Speed | Role (data, uplink, mgmt, console, storage) |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |

### 3c. Devices (installed units)

| Device id | Name / hostname | Type id | Rack | Lowest U (position) | Faces rack front or rear | Role | Status (planned/existing/remove) |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
| | | | | | | | |

## 4. Ports and cabling needs  [`cables`]

| Need | Quantity / detail |
|---|---|
| Work-area outlets per room/zone, ports per outlet | |
| Horizontal media (Cat6 / Cat6A / fiber) and target speed | |
| Uplinks: from → to, speed, count, redundancy | |
| Server/storage connections per device (speed, count, DAC/AOC/fiber) | |
| Management and console connections | |
| Backbone between rooms/buildings: fiber type (OM3/OM4/OM5/OS2), strand count, connector (LC/MPO) | |
| Interconnect or cross-connect at each distributor | |
| Spare ports / growth percentage | |

## 5. Distances and pathways  [`cables[].lengthM`, `pathway`]

| From | To | Routed length (m) | Pathway (tray, conduit, raised floor, overhead runway) | Fill / capacity known? | Measured or estimated |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |

Service loop / slack policy (%): ____  Cord stock lengths available (m): ______________

## 6. Power  [`pdus`, `powerLinks`, `policy.powerDerating`]

| Item | Value |
|---|---|
| Feeds available (A/B, UPS-backed?) | |
| Per rack: circuits, voltage, phases (1/3), breaker rating (A), plug/receptacle type | |
| Panel / breaker references for each circuit | |
| PDU model per feed: mounting (0U-left/0U-right/rack), outlet groups (connector x count), metering | |
| Local electrical code and derating rule (confirm with electrician) | |
| Power basis for the budget (max or typical) | |
| Single-PSU devices needing an ATS | |
| UPS model, capacity, runtime target (owned by electrical/UPS design) | |
| Qualified electrician / facilities contact | |

## 7. Cooling and airflow  [`racks[].frontAisle`, type `airflow`]

| Item | Value |
|---|---|
| Room layout: hot/cold aisles, which way each rack row faces | |
| Cooling type (CRAC/CRAH, in-row, split, comfort AC only) | |
| Containment (none, cold aisle, hot aisle, chimney) | |
| Inlet temperature target / measured inlet temperatures | |
| Side-to-side equipment needing duct kits | |
| Blanking panel policy (required?) | |

## 8. Labeling and color conventions  [`policy.labelPattern`, `policy.colorByFunction`]

| Item | Value |
|---|---|
| Existing site labeling standard (TIA-606 class, internal standard) | |
| Identifier format for racks, panels, ports, cables (examples) | |
| Cable label regex to enforce | |
| Colors by function (data, uplink, mgmt, console, storage, crossconnect, horizontal, backbone) | |
| Label printer / material | |

## 9. Constraints

| Constraint | Detail |
|---|---|
| Budget / preferred vendors / existing standards | |
| Maintenance windows and change freeze periods | |
| Seismic, fire code, cable rating (plenum/riser/LSZH) requirements | |
| Security / confidentiality of documentation | |
| Deadline and phasing | |

## 10. Open questions

| # | Question | Owner | Due | Answer |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
