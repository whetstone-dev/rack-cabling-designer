# Rack power

Use this for PDU sizing, A/B redundancy, connector pairing and heat load, and to explain RCD-PWR-* findings. Data: `../assets/data/power.json`.

> **Safety:** the power budget is a planning aid. Circuits, breakers, conductors, feeds, earthing and UPS/ATS installations must be designed, installed and verified by qualified electricians under the electrical code in force (e.g. NEC, IEC 60364, RETIE in Colombia). Never present `power.md` as an electrical design.

## Formulas

| Quantity | Formula | Model fields |
|---|---|---|
| Single-phase capacity | W = V × A | `phases: 1` (default), `voltage`, `maxAmps` |
| Three-phase capacity | W = √3 × V(line-to-line) × A | `phases: 3`; enter **line-to-line** voltage (e.g. 400 V, 208 V) |
| Usable (continuous) capacity | capacity × derating | `policy.powerDerating` (default 0.8 from power.json) |
| Heat load | BTU/h = W × 3.412 | power.json `wattsToBtuPerHour` |

`maxAmps` should be the limiting rating of the path: the lower of the upstream breaker and the PDU input rating. Some PDUs are already labelled with a derated current; do not derate twice — set `powerDerating: 1` and say so in `notes` if you enter an already-derated figure.

Worked capacities:
- 230 V, 16 A, 1-phase: 3,680 W; usable at 0.8 = 2,944 W.
- 230 V, 32 A, 1-phase: 7,360 W; usable = 5,888 W.
- 400 V, 16 A, 3-phase: √3 × 400 × 16 = 11,085 W; usable = 8,868 W.
- 208 V, 30 A, 3-phase: √3 × 208 × 30 = 10,808 W; usable = 8,646 W.

## Derating

power.json default 0.8 reflects the continuous-load practice of loading branch circuits to 80% of the breaker rating (its cited example is NEC 210.20(A)). Other codes and utilities differ, and some breakers are rated for 100% continuous load. Set `policy.powerDerating` (0.1–1) to what the local code and the electrician specify, and state it in the hand-over. RETIE and IEC 60364-based designs are not automatically 0.8 — ask.

## Which power figure (powerBasis)

| Figure | Source | Use |
|---|---|---|
| Nameplate / PSU rating | Label on the PSU (e.g. 1100 W PSU) | Not a consumption figure; never sum PSU ratings |
| Max (`power.maxW`) | Vendor power calculator at full configuration and load | Default basis (`powerBasis: "max"`), conservative for circuit planning |
| Typical (`power.typicalW`) | Datasheet typical / calculator at expected load | `powerBasis: "typical"` for energy and cooling estimates |
| Measured | Metered PDU, BMC, clamp meter | OBSERVED; put in a model-specific type's `typicalW` and say so in `notes` |

If the chosen figure is missing the tool falls back to the other one; if both are missing the device counts as 0 W and **RCD-PWR-DATA** warns (INCONCLUSIVE).

## A/B (2N) design and the failover math

Each PDU has a `feed` (e.g. `A`, `B`). Each dual-PSU device should have one inlet on each feed. The tool computes (APPROXIMATE model):

1. **Normal**: a device's load is split evenly across its connected inlets; each PDU sums its share.
2. **Feed loss**: for every feed F, remove all inlets on F; surviving inlets of each device carry the whole device load. A device with all inlets on F drops out (it is down, which **RCD-PWR-REDUNDANCY** already warned about).
3. Each PDU's **worst failover load** is the maximum over the loss of every *other* feed.

Checks: normal load > usable → **RCD-PWR-CAPACITY** (error); worst failover load > usable → **RCD-PWR-FAILOVER** (error).

Worked example (`../examples/datacenter-pod.rack.json`, rack A01, `powerBasis: max`): two leaves 550 W, four 1U servers 750 W, one storage array 900 W; each device has PSU1 on A01-PDU-A and PSU2 on A01-PDU-B (230 V, 32 A, usable 5,888 W).
- Total = 2×550 + 4×750 + 900 = 5,000 W. Normal per PDU = 2,500 W (34% of 7,360 W).
- Feed B fails: PDU-A carries 5,000 W (68%) < 5,888 W → passes.
- Add one 2U server (1,100 W max): total 6,100 W. Normal 3,050 W per PDU passes, but on feed loss PDU-A carries 6,100 W > 5,888 W → RCD-PWR-FAILOVER. Explain it as "PDU-A would carry 6.1 kW if feed B fails; its usable limit is 5.9 kW". Fixes: a larger circuit (e.g. 3-phase), a second PDU pair, `powerBasis: typical` only if the user accepts that risk explicitly, or moving load to another rack.

Rule of thumb: in 2N, each PDU must be sized for the **whole** rack load, so normal loading stays below about 50% of usable capacity.

Real PSUs may not share exactly 50/50 (active/standby modes, imbalance); the even split is APPROXIMATE.

## Connectors (power.json `inletOutlet`)

| Device inlet | Fits outlet | With hybrid cord (warning) |
|---|---|---|
| C14 | C13 | C19 (C20-to-C13 cord) |
| C20 | C19 | — |
| C8 | C7 | — |
| C6 | C5 | — |
| NEMA-5-15P | NEMA-5-15R, NEMA-5-20R | — |
| CEE-7/7 | CEE-7/3, CEE-7/5 | — |

**RCD-PWR-CONNECTOR**: error when the inlet cannot be fed from that outlet type (e.g. a C20 inlet on a C13 outlet), warning when a hybrid cord is needed. Matching is case-insensitive; connectors not in this table are not checked. Typical ratings: C13/C14 about 10 A (15 A in North American listings), C19/C20 about 16 A (20 A) — verify the cord and PDU ratings. High-power servers and chassis usually need C19/C20.

## PDUs in the model

| Field | Notes |
|---|---|
| `mounting` | `0U-left` / `0U-right` (vertical, in the side channel, no U) or `rack` (horizontal, uses `position`/`heightU`, default `face: rear`) |
| `outlets` | Groups `{connector, count}`; outlets are numbered consecutively from 1 in declaration order. `[{C13,36},{C19,6}]` → 1–36 are C13, 37–42 are C19. |
| `circuit` | Upstream panel/breaker reference, e.g. `UPS-A / PP-A1 / 07` |
| `powerLinks` | `{device, inlet, pdu, outlet}`: one per cord |

Other findings: **RCD-PWR-OUTLET** (outlet number beyond the PDU's count, or two cords on one outlet), **RCD-PWR-INLET** (inlet id not on the type, or connected twice), **RCD-PWR-UNPOWERED** (no links, or some declared inlets unconnected), **RCD-PWR-REDUNDANCY** (all inlets on one feed; or single-fed / single-feed rack when `policy.requireRedundantPower` is true), **RCD-PWR-RACK** (device fed from a PDU in another rack).

0U PDUs keep U free and put outlets near PSUs but need cabinet depth/width for the channel; rack-mount PDUs fit shallow racks and 2-post frames but consume U.

## Heat load

Rack heat (BTU/h) = rack load W × 3.412, reported per rack in `power.md`. A01 above: 5,000 W → 17,060 BTU/h (about 1.4 tons of refrigeration at 12,000 BTU/h per ton). Use the same basis the cooling engineer expects (typical vs max) and say which one you used. See [airflow.md](airflow.md).

## UPS and ATS notes

- Model the UPS path in the PDU `feed`/`circuit` text (e.g. feed `A` = `UPS-A`). The tool does not chain UPS → PDU loads or check UPS capacity or runtime.
- A rack-mount UPS is a device (`category: "ups"`): its weight and U count, its own losses can be its power figure. Mount it low (heavy).
- Single-PSU devices on A/B need an ATS. The tool cannot model an ATS feeding a device; document it in `notes` and expect RCD-PWR-UNPOWERED/REDUNDANCY findings to be explained manually.
- Do not plug UPS or PDU daisy chains into other PDUs.

## Common mistakes

- Using 230 V for a 400 V three-phase PDU (capacity understated by √3) or phase-neutral voltage in the √3 formula.
- Summing PSU nameplate ratings instead of measured or calculated draw.
- Checking only normal load; the failover case is what trips breakers.
- Both PSUs of a device on the same PDU or feed.
- Forgetting that removed devices (`status: "remove"`) are still counted in the budget until deleted from the model.
