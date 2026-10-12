# Structured cabling

Use this for topology, patch panels, cross-connects and the copper channel model, and to explain RCD-CBL-CHANNEL and RCD-CBL-SIDE. Media choice and reach are in [media.md](media.md); labels in [labeling.md](labeling.md).

Standards referenced (concepts paraphrased, confirm the edition in force): ANSI/TIA-568 series and ISO/IEC 11801 (generic cabling), TIA-569 (pathways and spaces), TIA-942 (data centers), TIA-606 (administration).

## Topology at a glance

| Subsystem | Runs between | Typical media |
|---|---|---|
| Work area | Outlet to end device (user cord) | Copper patch cord |
| Horizontal | Telecom room (TR/IDF) patch panel to work-area outlet; installed, star from one TR | Cat6/Cat6A solid copper; sometimes fiber |
| Backbone | Equipment room / MDF to TRs, building to building, MDA to HDA | Fiber (OM3/OM4/OS2); copper for voice/short runs |
| Telecom room (TR / IDF) | Floor distribution, horizontal cross-connect, access switches | — |
| Equipment room (ER / MDF) | Main cross-connect, core equipment, entrance facilities nearby | — |

Decision rules:
- Horizontal cabling is a star: one TR serves each outlet, no splices or taps in copper horizontal links.
- Do not run horizontal copper beyond the channel model below; place another TR instead.
- Backbone between floors/buildings is fiber unless the run is short and the application is copper-only.

## TIA-942 data center spaces

| Space | Role | Model hint |
|---|---|---|
| ENI (entrance room) | Carrier demarcation, entrance cabling | `location` kind `room` |
| MDA (main distribution area) | Main cross-connect, core routers/switches | Network racks with fiber panels |
| HDA (horizontal distribution area) | Horizontal cross-connect for a zone/row, often end-of-row | `location` kind `row` |
| ZDA (zone distribution area) | Optional consolidation point between HDA and EDA; passive only | Patch panels, no active gear |
| EDA (equipment distribution area) | Server/storage cabinets | Compute racks; top-of-rack switches are common |

Top-of-rack (ToR) puts switches in each EDA rack with short DAC/AOC/fiber to servers; end-of-row (EoR) puts switches in the HDA with structured cabling to every EDA. See `../examples/datacenter-pod.rack.json` (ToR leaves, OS2 trunk between LC panels).

## Channel vs permanent link (copper)

Values from `../assets/data/media.json` `channelModel` (source: ANSI/TIA-568.0-D and ISO/IEC 11801-1 horizontal channel model):

| Limit | Value | Tool behaviour |
|---|---|---|
| Permanent link (installed cable, panel to outlet) | 90 m | **RCD-CBL-CHANNEL** error per permanent segment over 90 m |
| Cords in the channel (equipment cord + patch cords + work-area cord) | 10 m total | **RCD-CBL-CHANNEL** warning when the cord sum exceeds 10 m (only checked when the channel has a permanent segment) |
| Whole channel | 100 m | Covered by the media reach (**RCD-CBL-REACH**); see [media.md](media.md) |

The tool classifies each cable segment of a traced channel:
- **permanent**: both ends on the **rear** of passive items (`patch-panel` or `outlet` categories). This is the installed horizontal or backbone cable.
- **cord**: everything else (switch to panel front, outlet front to PC, DAC between switches).

Worked example: switch → 3 m cord → panel → 88 m horizontal → outlet → 5 m work-area cord. Permanent 88 m (OK), cords 8 m (OK), channel 96 m (OK for Cat6A at 10G per media.json). With a 7 m work-area cord: cords 10 m (OK, at the limit), channel 98 m. With a 9 m work-area cord: cords 12 m → RCD-CBL-CHANNEL warning even though the 100 m reach is not exceeded.

Fiber channels have no permanent-link/cord split in the tool; only reach and media mixing are checked, and insertion loss is not computed (see [media.md](media.md)).

## Interconnect vs cross-connect

| Design | Path | Pros | Cons |
|---|---|---|---|
| Interconnect | Switch port → cord → patch panel (front) ⇢ installed cable | Fewer connections, lower loss, cheaper | Moves/adds/changes touch switch ports |
| Cross-connect | Switch port → equipment cable → panel A; panel B ⇢ installed cable; patch cord between panel A and panel B fronts | Switch cabling never touched; all changes on passive panels | Extra connector pairs (loss), more space |

Cross-connects are common at the MDA/HDA and for multi-tenant or carrier demarcation. In the model, a cross-connect is two panels with a cord between their front ports (`function: "crossconnect"`).

## How the model represents panels and outlets

- Use equipment types with `category: "patch-panel"` (rack panels) or `"outlet"` (faceplates, `heightU: 0`, placed by `location`). These are the only **passive** categories.
- Each passive port has a **front** and a **rear**. Front port N is internally connected to rear port N. The tracer follows that link to build an end-to-end channel.
- Patch cords plug into the front: endpoint `{ "device": "pp1", "port": "1" }` (side defaults to `front`).
- Installed cables terminate on the rear: `{ "device": "pp1", "port": "1", "side": "rear" }`.
- `rearConnector` on the port spec describes the rear termination (e.g. `punchdown` for copper keystone/110 blocks). If omitted, the rear uses the front connector (typical for LC fiber panels with pre-terminated or spliced rears).
- `side` on an active device (switch, server…) is an error: **RCD-CBL-SIDE**. Active ports have only one side.
- One cable per port and side (**RCD-CBL-PORT-REUSE**). Port names must exist on the type, with `{a-b}` range expansion (**RCD-CBL-PORT**).

Example (from `../examples/small-office.rack.json`): `p1` sw1 Gi1/0/1 → pp1 front 1 (cord, 0.5 m); `h1` pp1 rear 1 → wo1 rear 1 (permanent, 35 m). `trace` shows the channel `sw1 → pp1 → wo1`, open at the outlet because no work-area cord is modeled. Add the user cord as a cable from `wo1` front to the end device if it matters for the cord budget.

## Cable management and bend radius

| Item | Rule of thumb (typical — follow the cable manufacturer) |
|---|---|
| UTP installed bend radius | about 4 × cable outer diameter |
| Shielded / Cat6A large-diameter cable | often 8 × outer diameter |
| Fiber, no tension (installed) | about 10 × outer diameter, or the manufacturer's minimum |
| Fiber under pulling tension | about 15–20 × outer diameter |
| Horizontal managers | One per 1–2 dense panels or switches |
| Bundles | Hook-and-loop ties, not tight plastic ties; avoid crushing |

The tool does not model bend radius, pathway fill or tray capacity. Mention it in notes and in the installation spec.

## Separation from power

Keep data cabling separated from power circuits and fluorescent/motor sources. Required distances depend on circuit size, shielding, and whether a metallic barrier is present; commonly cited figures range from a few centimetres to about 300 mm. Follow the applicable standard (e.g. TIA-569, EN 50174-2) and the local electrical code; cross power at right angles. Not checked by the tool.

## Certification testing vs this tool

| | rackcab | Field certification |
|---|---|---|
| What | Model consistency: topology, lengths, media/speed fit, port use | Measured performance of the installed link against a standard limit set |
| How | Declared `lengthM`, media and ports | Certifier (permanent link or channel adapters), OTDR/OLTS for fiber |
| Evidence label | MODELED | OBSERVED |

A passing `validate` is never a substitute for certification test reports. Ask for certification results as part of handover ([documentation.md](documentation.md)).

## Common mistakes

- Running the installed cable from panel **front** to outlet: it becomes a cord and the 90 m check is skipped.
- Modeling a panel as `category: "other"`: it becomes active, the channel stops there, and `side` is rejected.
- Counting the 90 m against the straight-line distance; use routed pathway length plus service loops (`policy.cableSlackPercent` affects only the BOM, not reach).
- Forgetting the work-area and equipment cords in the 10 m budget.
