# Airflow and cooling layout

Use this to orient equipment in hot/cold-aisle rooms and to explain RCD-AIR-* findings. Heat load figures come from [power.md](power.md); rack placement from [racks.md](racks.md).

## Hot aisle / cold aisle in one paragraph

Racks are arranged in rows with fronts facing fronts (cold aisle, supplied with cooled air) and rears facing rears (hot aisle, returning to the cooling units). Every piece of active equipment must take air from the cold aisle and exhaust into the hot aisle. Mixing (hot exhaust re-entering an intake) raises inlet temperatures and wastes cooling capacity. Inlet temperature targets come from the operator's policy and guidance such as ASHRAE TC 9.9 (a recommended inlet range of roughly 18–27 °C is commonly used — verify the current guideline and equipment specs).

## Airflow types (equipment type `airflow`)

Directions are relative to the **equipment's own front as defined by its type**. For network gear the type's front is the **port side** (see `../assets/catalog/generic.json`).

| `airflow` | Air path | Typical for |
|---|---|---|
| `front-to-back` | In at the type front, out at the rear | Servers, storage; switches ordered with "port-side intake" fans/PSUs |
| `back-to-front` | In at the type rear, out at the type front | Switches ordered with "port-side exhaust" (PSU-side intake) fans/PSUs |
| `side-to-side` | In one side, out the other | Some access/campus switches and older chassis |
| `passive` | No fans | Patch panels, cable managers, blanking, shelves |

Many data-center switches are sold in both versions; the airflow is set by the fan trays and PSUs ordered. Make the model match the purchase order.

## How the tool decides the intake side

1. Rack `frontAisle`: aisle the rack front faces, `cold` (default), `hot`, or `none`. With `none` all airflow checks are skipped (closets, wall cabinets without aisles; the BOM then adds no blanking panels).
2. Device `face`: which rack face the equipment's own front looks at (`front` default, or `rear`).
3. Intake face of the rack:

| Type `airflow` | Device `face` | Intake on rack face |
|---|---|---|
| front-to-back | front | front |
| front-to-back | rear | rear |
| back-to-front | front | rear |
| back-to-front | rear | front |

4. The rack front is in `frontAisle`; the rear is in the opposite aisle. Intake in the hot aisle → **RCD-AIR-RECIRC** (error): "reverse its mounting or order the opposite airflow option".

Other findings:
- **RCD-AIR-SIDE** (warning): `side-to-side` equipment in a rack with aisles; it needs a side-intake duct/baffle kit that pulls air from the cold aisle. The tool cannot verify the kit; note it.
- **RCD-AIR-DATA** (info): active equipment without an `airflow` value; not checked (INCONCLUSIVE).
- **RCD-AIR-BLANKING**: open units on the cold face of a rack that contains airflow-checked equipment. Info by default, warning when `policy.requireBlankingPanels` is true. The BOM adds one 1U blanking panel per open cold-face unit.

## Worked example: leaf switches facing the rear

From `../examples/datacenter-pod.rack.json`: rack A01 has `frontAisle: "cold"`. Servers face front (ports and cables at the rear). To keep server-to-leaf DACs short, the leaves are mounted with their **ports to the rear**:

```json
{ "id": "leaf-48-25g-pse", "category": "switch", "airflow": "back-to-front", ... ,
  "notes": "Ports face the rear of the rack; fans exhaust on the port side, so the PSU side breathes from the cold aisle." }
{ "id": "leaf1", "type": "leaf-48-25g-pse", "rack": "A01", "position": 42, "face": "rear" }
```

Evaluation: type front = port side; `face: rear` puts the ports on the rack rear (hot aisle). `back-to-front` takes air at the type rear (PSU side), which now faces the rack front, i.e. the cold aisle. Exhaust leaves from the port side into the hot aisle. No finding.

Counter-example: the catalog's `generic-leaf-48-25g-6-100g` is `front-to-back` (port-side intake). Mounted with `face: rear`, its intake is the rack rear = hot aisle → RCD-AIR-RECIRC. Fix: order port-side-exhaust fans/PSUs (and model it as `back-to-front`) or mount the switch facing front and accept longer cords routed to the rear.

Decision rule for switches:
- Ports facing the cold aisle (front) → order port-side **intake** (model `front-to-back`, `face: front`).
- Ports facing the hot aisle (rear, ToR next to server NICs) → order port-side **exhaust** (model `back-to-front`, `face: rear`).

## Blanking panels

- Every open unit on the cold face is a path for hot air back to the front. Fill them with blanking panels (tool-less 1U panels are typical).
- Rear-only half-depth items (e.g. a fiber panel mounted on the rear at U40) leave the **front** of that unit open: the tool reports it under RCD-AIR-BLANKING. Blank it on the front.
- 0U PDUs and side gaps between rails and cabinet sides also leak; use side/rail seals where the cabinet supports them (not modeled).

## Containment basics

| Option | Idea | Note |
|---|---|---|
| Cold-aisle containment | Doors/roof over the cold aisle; room becomes the hot return | Simpler retrofit; rest of the room runs hot |
| Hot-aisle containment | Enclose the hot aisle or use rack chimneys to a ceiling plenum | Room stays cool; needs return path |
| In-row cooling | Coolers between racks, short air path | For higher densities |

Containment only works when every rack in the row follows the same orientation, all units are blanked, and cable openings in floors/roofs are brushed or sealed. Fire suppression and detection interactions with containment are a facilities/fire-code matter (not modeled).

## Cables and airflow

- Dense cable bundles behind servers and switches block exhaust; use vertical managers and route to the side channels.
- Underfloor plenums used for air must not be stuffed with abandoned cable; remove abandoned cable during changes (and follow local code for abandoned cable).
- Rear cable management arms and 0U PDUs can shadow PSU exhaust; check clearance on deep servers.
- Do not run patch cords across the front intake of other equipment.

## Common mistakes

- Leaving `face: front` for a switch that is physically mounted ports-to-rear.
- Assuming "front-to-back" in a switch datasheet refers to the rack front; it usually refers to the port side.
- Ignoring side-to-side access switches in data-center rows (RCD-AIR-SIDE).
- Setting `frontAisle: "none"` in a real hot/cold aisle room to silence findings.
- Blanking only the front of racks whose front faces the hot aisle (`frontAisle: "hot"`): the cold face is the rear there; the tool checks the rear.
