# Media, connectors and transceivers

Use this to pick cable/fiber/optics, answer "maximum length" questions and explain RCD-CBL-MEDIA, RCD-CBL-SPEED, RCD-CBL-REACH, RCD-CBL-MIXED and RCD-CBL-OPTIC. Topology and the copper channel model are in [structured-cabling.md](structured-cabling.md).

## Reach table (from `../assets/data/media.json`)

Nominal maximum channel length in metres, planning values only. "—" = not listed in media.json; the tool then reports **RCD-CBL-SPEED** ("not specified for that speed").

| Media (`media` value) | 100M | 1G | 2.5G | 5G | 10G | 25G | 40G | 100G |
|---|---|---|---|---|---|---|---|---|
| Cat5e (`cat5e`) | 100 | 100 | 100 | — | — | — | — | — |
| Cat6 (`cat6`) | 100 | 100 | 100 | 100 | 55 ¹ | — | — | — |
| Cat6A (`cat6a`) | 100 | 100 | 100 | 100 | 100 | — | — | — |
| Cat8 (`cat8`) | 30 | 30 | 30 | 30 | 30 | 30 | 30 | — |
| OM1 62.5/125 (`om1`) | — | 275 | — | — | 33 | — | — | — |
| OM2 50/125 (`om2`) | — | 550 | — | — | 82 | — | — | — |
| OM3 (`om3`) | — | 550 | — | — | 300 | 70 | 100 | 70 |
| OM4 (`om4`) | — | 550 | — | — | 400 ² | 100 | 150 | 100 |
| OM5 (`om5`) | — | 550 | — | — | 400 | 100 | 150 | 100 |
| OS2 9/125 (`os2`) | — | 5000 | — | — | 10000 | 10000 | 10000 | 10000 |
| Passive DAC (`dac`) | — | 5 | — | — | 7 | 5 ³ | 7 | 5 |
| AOC (`aoc`) | — | — | — | — | 100 | 100 | 100 | 100 |

¹ 10GBASE-T on Cat6 up to 55 m, subject to alien-crosstalk mitigation (TIA TSB-155). ² 10GBASE-SR on OM4 at 400 m is an engineered link. ³ 25GBASE-CR 5 m with RS-FEC, 3 m for CR-S. OM5 values are listed "as OM4" (its wideband benefit applies to SWDM optics, not to these). DAC 1G/10G and all AOC values are vendor-typical; AOC reach is product-specific. Sources per cell (IEEE 802.3 clauses, TIA-568.2-D) are in media.json.

How the tool uses it: a channel's speed is the **slower** of its two active end ports; the limit is the **lowest** reach among the media in the channel; channel length is the sum of `lengthM` of all its cables. Over the limit → **RCD-CBL-REACH** (error). Missing `lengthM` → **RCD-CBL-LENGTH-MISSING** (warning; reach INCONCLUSIVE).

## Selection rules

| Situation | Prefer |
|---|---|
| Work-area/horizontal copper, 1G now, 10G later | Cat6A (100 m at 10G) |
| Existing Cat6 at 10G | OK up to 55 m only, alien-crosstalk caveat |
| In-rack server/switch at 10/25/100G, ≤ 3–5 m | Passive DAC (cheapest, lowest power) |
| Adjacent racks, 5–30 m, fixed endpoints | AOC, or optics + fiber patch cords |
| Row/room backbone, multimode installed | OM4 (OM3 if existing); check reach for the target speed |
| Between buildings, > 400 m, or future-proof backbone | OS2 single-mode |
| New multimode where OM1/OM2 exists | Replace or move to OS2; OM1/OM2 reaches collapse at 10G (33/82 m) |

## Copper categories

Cat5e/6/6A are 100 m-class channels; Cat8 is a 30 m channel intended for switch-to-server within a row. 2.5G/5GBASE-T (`speed: "2.5G" | "5G"`) reuse installed Cat5e/Cat6 for Wi-Fi access points. PoE heating of bundles is not modeled (see [safety.md](safety.md)).

## Connectors (model `connector` values)

| Value | What it is | Accepts (tool check RCD-CBL-MEDIA) |
|---|---|---|
| `rj45`, `punchdown` | Copper jack / IDC termination | Copper only; fiber/DAC → error |
| `lc-duplex`, `sc-duplex` | Duplex fiber (2 fibers) | Fiber |
| `mpo-12`, `mpo-24` | Multi-fiber push-on (12/24 fibers), used by parallel optics and trunks | Fiber |
| `sfp`, `sfp+`, `sfp28` | Cages for 1G / 10G / 25G modules | Fiber, DAC/AOC; copper only via BASE-T module in `sfp`/`sfp+` (warning: check module power, heat and reach) |
| `qsfp+`, `qsfp28` | Cages for 40G / 100G modules | Fiber, DAC/AOC; copper → error |

A DAC/AOC joining an SFP-family cage to a QSFP-family cage is a breakout: **RCD-CBL-MEDIA** error. Breakouts are not modeled — split them into explicit cables per lane group: declare the breakout sub-ports on your own equipment type (e.g. `Eth1/49/{1-4}`, connector `sfp28`, speed `25G`) and model one cable per sub-port, recording the single physical breakout assembly in `notes` (the BOM will otherwise count four cords). The tool does not check that the two fiber connectors on a cable match each other (e.g. LC vs MPO), except the SR4 case below.

## Transceiver names (media.json `optics`)

| Family \ speed | 1G | 10G | 25G | 40G | 100G |
|---|---|---|---|---|---|
| Multimode (`fiber-mm`) | 1000BASE-SX | 10GBASE-SR | 25GBASE-SR | 40GBASE-SR4 | 100GBASE-SR4 |
| Single-mode (`fiber-sm`) | 1000BASE-LX | 10GBASE-LR | 25GBASE-LR | 40GBASE-LR4 | 100GBASE-LR4 |
| Copper module | 1000BASE-T | 10GBASE-T | — | — | — |

Copper modules also exist for 2.5G and 5G (2.5GBASE-T, 5GBASE-T) in media.json. Copper modules fit SFP/SFP+ cages only (warning RCD-CBL-MEDIA: check their power draw, heat and shorter reach).

Naming: SX/SR = short reach multimode; LX/LR = long reach single-mode (10 km class); a trailing **4** = four lanes, either 4 parallel fibers each way (SR4, MPO) or 4 wavelengths on one duplex pair (LR4, LC). The BOM picks optics from this table per cage end and notes "verify vendor compatibility" (vendor coding).

## Parallel vs duplex optics

- 40GBASE-SR4 and 100GBASE-SR4 (media.json `parallelOptics`) need **MPO** connectivity end to end (8 of 12 fibers used).
- If a multimode channel at 40G/100G passes through a duplex (LC/SC) panel, the tool raises **RCD-CBL-OPTIC** (warning). Fix: MPO panels/cassettes and MPO trunks, or keep LC duplex and choose duplex multimode optics (BiDi or SWDM types; check reach on OM4/OM5 in their datasheets).
- LR4 optics are duplex LC, so OS2 LC panels are fine (as in `../examples/datacenter-pod.rack.json`).

## DAC vs AOC vs optics

| | Passive DAC | AOC | Optics + fiber |
|---|---|---|---|
| Reach (media.json) | 5–7 m | 100 m (vendor-typical) | Per fiber grade table above |
| Cost / power | Lowest | Medium | Highest (two modules) |
| Flexibility | Fixed length, bulky | Fixed length, thin | Reusable structured cabling, patchable |
| Use | In-rack, adjacent ToR | Adjacent racks, no patching | Anything through panels |

## Mixing and grades (RCD-CBL-MIXED)

- Multimode and single-mode in one channel → error (core diameters differ; massive loss).
- Different families (copper + fiber, DAC + fiber) in one channel → error.
- Different grades of the same family (OM3 cord on OM4 trunk, Cat6 cord on Cat6A link) → warning; the lowest grade sets the reach.

## Polarity (not modeled)

Duplex fiber must cross transmit to receive end to end. Typical practice: A-to-B duplex patch cords; MPO trunks use defined polarity methods (commonly called Type A, B, C) that must match cassettes and cords. Choose one method per site, document it, and verify with a polarity/visual tester. The tool does not check polarity.

## Insertion-loss budget (not computed by the tool — do it manually)

Loss = fiber length (km) × attenuation (dB/km) + mated connector pairs × loss per pair + splices × loss per splice. Compare with the optic's channel insertion-loss allowance from its datasheet or the IEEE clause listed in media.json. Keep margin.

| Component | Typical planning value (verify datasheets/standard) |
|---|---|
| Multimode fiber at 850 nm | about 3.0–3.5 dB/km |
| Single-mode fiber at 1310 nm | about 0.4–1.0 dB/km (cable type dependent) |
| Mated connector pair (LC/SC) | about 0.5 dB low-loss, up to 0.75 dB standard allowance |
| Mated MPO pair | about 0.35–0.75 dB depending on grade |
| Fusion splice | about 0.1–0.3 dB |

Worked example (typical values): 100GBASE-SR4 over 60 m OM4 with two MPO mated pairs. Fiber 0.06 × 3.0 = 0.18 dB; connectors 2 × 0.5 = 1.0 dB; total ≈ 1.2 dB. Short-reach parallel optics often allow under 2 dB total (check the datasheet), so this passes; with four standard 0.75 dB pairs (3.0 dB) it would fail even though the 100 m reach check passes. Report reach as MODELED and loss as APPROXIMATE (or OBSERVED once OLTS results exist).

## Common mistakes

- Assuming Cat6 does 10G at 100 m (55 m per media.json).
- Running SR4 through LC panels (RCD-CBL-OPTIC).
- Counting only the trunk length; reach is the whole channel including cords.
- Using DAC across racks beyond 5–7 m.
- Treating the reach table as a loss budget: many connector pairs can fail a short link.
