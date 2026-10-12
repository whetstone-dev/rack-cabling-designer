# Racks and rack elevations

Use this when placing equipment in racks, choosing rack type/depth, or explaining RCD-RACK-* findings. Model fields are in the JSON Schema (`../assets/schema/rack-model.schema.json`); see also [airflow.md](airflow.md) and [power.md](power.md).

## Units and widths (EIA-310)

| Item | Value | Notes |
|---|---|---|
| 1 rack unit (U) | 44.45 mm (1.75 in) | EIA-310. Equipment is usually slightly shorter (typical ~43.7 mm) so units stack without binding. |
| 19 in rack | 482.6 mm panel width | Standard IT width; `widthIn: 19`. Rail hole spacing is about 465 mm between rails (typical — verify with the rack vendor). |
| 23 in rack | 584.2 mm panel width | Common in telco/central offices; `widthIn: 23`. 19 in gear needs reducer brackets. |
| Rack height | 1–60 U in the model | 42U is the common data-center height; 24U and smaller for closets (typical, not a limit). |

Cabinet external widths of 600 mm (servers) and 800 mm (network racks needing vertical cable management) are typical choices, not standard requirements.

## Rack vs cabinet, 2-post vs 4-post

| Option | Use for | Avoid for |
|---|---|---|
| 2-post open rack (`posts: 2`) | Patch panels, light switches, telco gear, cable-heavy cross-connects | Deep or heavy servers, storage, UPS |
| 4-post open frame (`posts: 4`) | Network rows with good cable access, no security need | Hot/cold containment without accessories |
| 4-post cabinet (enclosed) | Servers, storage, anything needing doors, locks, containment, side panels | Very high patch density without wide (800 mm) frame |

Decision rule: anything mounted by its rails at four points (servers, storage, most chassis) goes in a 4-post rack. The tool warns with **RCD-RACK-2POST** when a device on a 2-post rack weighs more than 25 kg or is deeper than 400 mm (thresholds hard-coded in `scripts/lib/rules/rack.ts`; they are a screening heuristic — the manufacturer's 2-post kit rating governs).

## Depth selection

Required cabinet depth = deepest equipment + rear clearance for cables, power cords and PDUs + front clearance for door and bezel.

| Allowance | Typical value (verify against datasheets and rack drawings) |
|---|---|
| Rear cabling and power cords | 100–200 mm |
| Front door / bezel | 50–100 mm |
| 0U PDU behind rails | needs the rack's PDU channel; check the cabinet accepts 0U PDUs at that depth |

Worked example: deepest server 750 mm + 150 mm rear cabling + 75 mm front = 975 mm, so a 1000 mm cabinet is tight and a 1200 mm cabinet leaves room for cable management arms and growth.

What the tool checks (**RCD-RACK-DEPTH**):
- Error when a device's `depthMm` exceeds the rack `depthMm`. It compares against the rack figure you enter, so enter the **usable mounting depth** (rail-to-rail adjustable range or vendor "max equipment depth"), not the external cabinet depth.
- Warning when a front half-depth item and a rear half-depth item share units and their depths add up to more than the rack depth.
- Info when the rack has no `depthMm` but equipment does (fit not checked, INCONCLUSIVE).

Clearance for cables is **not** modeled. Add it yourself.

## Load ratings

| Rating | Meaning | Use in the model |
|---|---|---|
| Static | Rack standing on levelling feet, load evenly distributed | `maxLoadKg` for racks loaded in place |
| Dynamic / rolling | Rack moved on casters with equipment installed | Use this lower figure as `maxLoadKg` if the rack will be rolled loaded |
| Floor loading | Raised floor or slab capacity per area / per point load | Not modeled: check with facilities |

**RCD-RACK-WEIGHT**: error above `maxLoadKg`, warning above 90% of it, info when any rack item lacks `weightKg` (total incomplete). The total includes devices, rack-mount PDUs and 0U PDUs with a `weightKg`. Cables, rails and shelves without a weight are not counted. Datasheet weights are often "without rails/PSUs" — note it in `notes`.

## U numbering and the model's placement fields

U1 is the **bottom** unit; numbering goes up. `position` is the **lowest** U a device occupies.

| Field | Meaning |
|---|---|
| `position` | Lowest U. A 2U server at `position: 20` occupies U20–U21. Top U = position + heightU − 1. |
| `face` | Rack face the equipment's own front looks at: `front` (default) or `rear`. For network gear the type's front is the **port side** (see `../assets/catalog/generic.json` note). |
| `fullDepth` (on the type) | `true` = occupies the U on both rack faces. Default true, except `patch-panel`, `outlet`, `cable-manager`, `blanking`, `shelf`, which default to half-depth (one face only). |
| `heightU: 0` | Not placed in U (e.g. wall outlets); give it a `location` instead of `rack`/`position`. |
| PDU `mounting` | `0U-left`/`0U-right` (side channel, no U used) or `rack` (needs `position`, `heightU` default 1, `face` default `rear`). |

Rules: **RCD-RACK-BOUNDS** (device extends below U1 or above the rack height), **RCD-RACK-OVERLAP** (two items on the same face share a U; reported once per pair with the shared range), **RCD-RACK-POSITION** (device in a rack without `position`, `position` without `rack`, or rack-mount PDU without position).

Half-depth sharing: a 1U patch panel at U40 `face: front` and a 1U fiber panel at U40 `face: rear` do not collide, because each occupies one face. A full-depth switch at U40 collides with both. Make sure the combined depth fits (RCD-RACK-DEPTH warning).

Worked example (bounds): 42U rack, 2U storage at `position: 42` → occupies U42–U43 → RCD-RACK-BOUNDS. Fix: `position: 41`.

## Placement guidelines

| Rule | Why |
|---|---|
| Heaviest items (UPS, storage, large servers) at the bottom | Lower centre of gravity, safer lifting, lower tip risk |
| Patch panels and network switches at the top (or where cable trays enter) | Short cords to overhead pathways; keeps patching away from server rails |
| One horizontal cable manager per 1–2 patch panels / switches (typical) | Bend control and readable patching |
| Leave contiguous free space for growth (typical 20–30%, or per `policy.maxRackUtilization`) | Avoids fragmenting U and re-cabling later |
| Keep redundant pairs (leaf1/leaf2, PSU A/B) in separate units and on separate PDUs | Single failure or maintenance doesn't take both |
| Group by cable destination | Fewer crossing cords |
| Fill every open unit on the cold face with blanking panels | Airflow (see [airflow.md](airflow.md), RCD-AIR-BLANKING) |

**RCD-RACK-UTIL** (warning): counts units used on the **front** face (full-depth items count on both faces) against `policy.maxRackUtilization`. Example: 42U rack, 36 front units used = 86%; with `maxRackUtilization: 0.8` it warns.

## Common mistakes

- Using external cabinet depth as `depthMm` and missing that the rails are set shallower.
- Putting `position` as the top U of a multi-U device (it is the lowest U).
- Mounting a switch with ports to the rear but leaving `face: front`; airflow and elevations will be wrong.
- Forgetting that rack-mount PDUs default to `face: rear` and occupy U.
- Declaring a patch panel `fullDepth: true` on the type and then getting overlaps with rear-mounted panels.
- Planning to roll a loaded cabinet using its static rating.

## Explaining findings

State the rule and the numbers: "RCD-RACK-WEIGHT: rack A01 carries 945 kg; its rated load is 1000 kg (94%, above the 90% warning threshold). Move the storage shelf to A02 or confirm the static rating with the vendor." Mark weight totals as INCONCLUSIVE when the info finding reports items without weight.
