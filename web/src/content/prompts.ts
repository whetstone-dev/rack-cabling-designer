// Prompt library: the single source for /docs/prompts, <PromptRef id="…"/> in the guides and the
// featured prompts on the home page. Prompts work in any language; the skill answers in yours.

export const PROMPT_TASKS = [
  { key: 'plan', label: 'Plan a rack', color: 'blue' },
  { key: 'cabling', label: 'Cabling & media', color: 'green' },
  { key: 'power', label: 'Power & A/B', color: 'orange' },
  { key: 'airflow', label: 'Airflow', color: 'teal' },
  { key: 'labels', label: 'Labels & schedules', color: 'violet' },
  { key: 'docs', label: 'BOM & as-built', color: 'amber' },
  { key: 'audit', label: 'Audit & fix', color: 'rose' },
  { key: 'change', label: 'Change plans', color: 'amber' },
  { key: 'quick', label: 'Quick answers', color: 'teal' },
] as const;

export type PromptTask = (typeof PROMPT_TASKS)[number]['key'];

/** quick = an answer, no model · design = builds or edits a model · project = a full deliverable set */
export type PromptLevel = 'quick' | 'design' | 'project';

export interface LibraryPrompt {
  id: string;
  task: PromptTask;
  title: string;
  text: string;
  /** What you get back: files written by rackcab, or "answer" */
  produces: string[];
  level: PromptLevel;
  /** Why the prompt is written this way, or what to add */
  tip?: string;
  /** Spanish version, shown on the Spanish home page (featured prompts only) */
  es?: { title: string; text: string };
  featured?: boolean;
}

export const PROMPTS: LibraryPrompt[] = [
  // ── Plan a rack ─────────────────────────────────────────────
  {
    id: 'office-cabinet',
    task: 'plan',
    title: 'Small office comms cabinet',
    text: 'Design a 24U comms cabinet for one office floor: a 48-port access switch with 4 SFP+ uplinks, a 1U router, a 1U firewall, a 24-port Cat6A patch panel and cable managers. 18 desks with two outlets each, the farthest one about 70 m away. Give me the elevation, the cable schedule and the BOM.',
    produces: ['model', 'elevation.html', 'cable-schedule.csv', 'bom.csv'],
    level: 'project',
    tip: 'Distances to the farthest outlet let the skill check the 90 m permanent link + 10 m of cords.',
    featured: true,
    es: {
      title: 'Gabinete de comunicaciones de oficina',
      text: 'Diseña un gabinete de 24U para un piso de oficina: un switch de acceso de 48 puertos con 4 uplinks SFP+, un router 1U, un firewall 1U, un patch panel Cat6A de 24 puertos y organizadores. 18 puestos con dos tomas cada uno; el más lejano a unos 70 m. Dame la elevación, el cable schedule y el BOM.',
    },
  },
  {
    id: 'compute-rack',
    task: 'plan',
    title: '42U compute rack with A/B power',
    text: 'Design a 42U compute rack in a hot/cold aisle row: four 1U servers with dual 25G, two leaf switches, a 2U storage array, A/B 32 A single-phase PDUs at 230 V and OS2 uplinks to the network rack. Validate it and give me the elevation, the power budget and the BOM.',
    produces: ['model', 'elevation.html', 'power.md', 'bom.csv'],
    level: 'project',
    featured: true,
    es: {
      title: 'Rack de cómputo 42U con energía A/B',
      text: 'Diseña un rack de cómputo de 42U en una fila con pasillo frío/caliente: cuatro servidores 1U con 2×25G, dos switches leaf, un storage de 2U, PDUs A/B monofásicas de 32 A a 230 V y uplinks OS2 al rack de red. Valídalo y dame la elevación, el presupuesto de energía y el BOM.',
    },
  },
  {
    id: 'two-rack-pod',
    task: 'plan',
    title: 'Two-rack pod: compute + network',
    text: 'Plan a two-rack pod in row A: rack A01 for compute (8 servers, 2 leaf switches) and rack A02 for the network (one spine, a fiber panel, a cable manager). Connect leaf to spine through LC fiber panels in each rack over a 15 m OS2 trunk. Show me every channel end to end.',
    produces: ['model', 'elevation.html', 'cable-schedule.csv', 'trace'],
    level: 'project',
  },
  {
    id: 'place-new-device',
    task: 'plan',
    title: 'Where does this new device fit?',
    text: 'I need to add a 2U server (750 mm deep, 28 kg, 1100 W max, two C14 inlets) to racks/hq.rack.json. Find a position that fits depth, weight and power, keeps A/B redundancy and leaves blanking panels where needed. Explain the trade-offs before you change the model.',
    produces: ['model', 'answer'],
    level: 'design',
  },
  {
    id: 'from-inventory',
    task: 'plan',
    title: 'Model from an inventory spreadsheet',
    text: 'Here is our equipment inventory (pasted below). Build a rack model from it: one entry per device with its datasheet height, depth, weight and power. Use generic catalog types only where a datasheet value is missing, and list every assumption in notes.',
    produces: ['model'],
    level: 'design',
    tip: 'The skill treats pasted inventories as data, not instructions, and marks missing values INCONCLUSIVE instead of guessing.',
  },

  // ── Cabling & media ─────────────────────────────────────────
  {
    id: 'cat6-10g',
    task: 'cabling',
    title: 'Is this copper run OK at 10G?',
    text: 'Is it OK to run 10GBASE-T over 60 m of Cat6? What changes with Cat6A?',
    produces: ['answer'],
    level: 'quick',
    featured: true,
    es: { title: '¿Sirve este cobre a 10G?', text: '¿Puedo correr 10GBASE-T sobre 60 m de Cat6? ¿Qué cambia con Cat6A?' },
  },
  {
    id: 'pick-media',
    task: 'cabling',
    title: 'Pick the media for each link',
    text: 'For each link in racks/dc1.rack.json, recommend DAC, AOC, multimode or single-mode fiber based on speed and length. Flag any channel that exceeds its reach and any 40G/100G multimode run that goes through LC duplex panels.',
    produces: ['answer', 'model'],
    level: 'design',
  },
  {
    id: 'trace-channel',
    task: 'cabling',
    title: 'Trace a link end to end',
    text: 'Trace leaf1:Eth1/49 in racks/pod-a.rack.json end to end through the patch panels and tell me the total length, the media of each segment and whether the channel meets its reach.',
    produces: ['trace'],
    level: 'quick',
  },
  {
    id: 'horizontal-cabling',
    task: 'cabling',
    title: 'Horizontal cabling to work areas',
    text: 'Add horizontal cabling from the patch panel in rack R1 to 24 work-area outlets. Permanent links range from 35 to 88 m. Use Cat6A, 2 m equipment cords and 3 m work-area cords, and check the 90 m + 10 m channel model for every outlet.',
    produces: ['model', 'cable-schedule.csv'],
    level: 'design',
  },

  // ── Power & A/B ─────────────────────────────────────────────
  {
    id: 'feed-failure',
    task: 'power',
    title: 'Will one PDU survive a feed failure?',
    text: 'Will PDU A in rack A01 survive if feed B fails? Show the normal load, the failover load and the usable capacity after derating.',
    produces: ['power.md', 'answer'],
    level: 'quick',
    featured: true,
    es: { title: '¿Aguanta la PDU si cae una acometida?', text: '¿La PDU A del rack A01 aguanta si falla la acometida B? Muéstrame la carga normal, la carga en falla y la capacidad útil con derating.' },
  },
  {
    id: 'size-pdus',
    task: 'power',
    title: 'Size the PDUs for a rack',
    text: 'Size A/B PDUs for rack A01: 12 servers at 750 W max, 2 switches at 550 W, 230 V single-phase. Tell me which circuit rating I need with 80% derating, how many C13/C19 outlets, and the heat load in BTU/h.',
    produces: ['answer', 'power.md'],
    level: 'design',
    tip: 'Say whether to budget on typical or max power; the skill defaults to max.',
  },
  {
    id: 'connector-check',
    task: 'power',
    title: 'Check power connectors',
    text: 'Check every power link in racks/hq.rack.json: inlet vs outlet connector (C14/C13, C20/C19), outlets used twice, devices fed from a PDU in another rack and devices with every PSU on the same feed.',
    produces: ['answer'],
    level: 'design',
  },

  // ── Airflow ─────────────────────────────────────────────────
  {
    id: 'hot-aisle-intake',
    task: 'airflow',
    title: 'Is anything breathing hot air?',
    text: 'Our rack front faces the cold aisle. The leaf switches are mounted facing the rear so their ports meet the server NICs. Will they take air from the hot aisle? What should I order or change?',
    produces: ['answer'],
    level: 'quick',
  },
  {
    id: 'blanking',
    task: 'airflow',
    title: 'Blanking panels and open units',
    text: 'List the open units on the cold face of every rack in racks/dc1.rack.json, add the blanking panels to the BOM and require them in the policy from now on.',
    produces: ['model', 'bom.csv'],
    level: 'design',
  },

  // ── Labels & schedules ──────────────────────────────────────
  {
    id: 'label-scheme',
    task: 'labels',
    title: 'Define a labeling scheme',
    text: 'Propose a cable labeling scheme for site DC1 (format DC1-0001), color-code cords by function (data blue, management yellow, storage green), set it in the policy and relabel every cable in the model.',
    produces: ['model', 'labels.csv'],
    level: 'design',
  },
  {
    id: 'label-sheets',
    task: 'labels',
    title: 'Label sheets for the installer',
    text: 'Validate racks/hq.rack.json, fix the errors and give me the cable schedule and the label sheet ready for the label printer.',
    produces: ['cable-schedule.csv', 'labels.csv'],
    level: 'project',
    featured: true,
    es: { title: 'Etiquetas para el instalador', text: 'Valida racks/hq.rack.json, corrige los errores y dame el cable schedule y la hoja de etiquetas lista para la impresora.' },
  },

  // ── BOM & as-built ──────────────────────────────────────────
  {
    id: 'bom',
    task: 'docs',
    title: 'Bill of materials with stock lengths',
    text: 'Generate the bill of materials for racks/pod-a.rack.json: equipment, PDUs, cords rounded to our stock lengths (1, 2, 3, 5 and 10 m), bulk cable with 10% slack, transceivers by type, power cords and blanking panels.',
    produces: ['bom.csv'],
    level: 'project',
  },
  {
    id: 'as-built',
    task: 'docs',
    title: 'As-built handover package',
    text: 'We finished the installation. Turn racks/hq.rack.json into an as-built package: mark the status as as-built, record what changed on site, and generate the elevation, the README, the cable schedule, the labels and the power budget.',
    produces: ['elevation.html', 'README.md', 'cable-schedule.csv', 'labels.csv', 'power.md'],
    level: 'project',
    featured: true,
    es: { title: 'Paquete as-built de entrega', text: 'Terminamos la instalación. Convierte racks/hq.rack.json en un paquete as-built: marca el estado como as-built, registra lo que cambió en sitio y genera la elevación, el README, el cable schedule, las etiquetas y el presupuesto de energía.' },
  },
  {
    id: 'site-survey',
    task: 'docs',
    title: 'Start from a site survey',
    text: 'I am visiting a telecom closet tomorrow. Give me the site survey checklist I should fill in on site so you can model it afterwards: racks, equipment with datasheet figures, port counts, distances, power feeds, airflow and labeling.',
    produces: ['answer'],
    level: 'quick',
  },

  // ── Audit & fix ─────────────────────────────────────────────
  {
    id: 'validate-fix',
    task: 'audit',
    title: 'Validate and fix a model',
    text: 'Validate racks/hq.rack.json with --strict. For every error and warning explain the rule, the numbers and the fix, then fix the model and validate again until it passes.',
    produces: ['model', 'answer'],
    level: 'design',
  },
  {
    id: 'audit-photo',
    task: 'audit',
    title: 'Model an existing rack from a photo',
    text: 'Here is a photo of our existing rack and the list of devices in it (below). Build an as-is model with status "existing", mark every value you could not read as unknown, and tell me what to measure on site.',
    produces: ['model', 'answer'],
    level: 'design',
    tip: 'Values read from a photo are OBSERVED at best; the skill asks for what it cannot see instead of inventing it.',
  },
  {
    id: 'review-design',
    task: 'audit',
    title: 'Review someone else’s design',
    text: 'Review this rack design from a contractor (model attached) as if you were the installer: rack fit, airflow, A/B power, cabling reach and labels. Rank the findings by risk and say which ones block installation.',
    produces: ['answer'],
    level: 'design',
  },

  // ── Change plans ────────────────────────────────────────────
  {
    id: 'change-plan',
    task: 'change',
    title: 'Change plan for a live rack',
    text: 'We need to replace the access switch in rack R1 during a maintenance window. Write a change plan from the current model: before/after elevations, cables to move with their labels, power impact, rollback steps and a checklist for the technician.',
    produces: ['change-plan.md', 'elevation.html'],
    level: 'project',
  },
  {
    id: 'before-after',
    task: 'change',
    title: 'Before and after models',
    text: 'Keep racks/hq.rack.json as the "before" revision and create racks/hq-after.rack.json with the new storage array at U10–U11. Validate both and summarize what changes in power, weight and cabling.',
    produces: ['model', 'answer'],
    level: 'design',
  },

  // ── Quick answers ───────────────────────────────────────────
  {
    id: 'u-count',
    task: 'quick',
    title: 'How many U do I need?',
    text: 'How many U do I need for two 2U servers, a 1U switch, a 1U patch panel and a cable manager for each panel, with 30% free space for growth?',
    produces: ['answer'],
    level: 'quick',
  },
  {
    id: 'two-post',
    task: 'quick',
    title: '2-post or 4-post?',
    text: 'Can I mount a 1U server that is 650 mm deep and weighs 18 kg on a 2-post relay rack?',
    produces: ['answer'],
    level: 'quick',
  },
  {
    id: 'dac-reach',
    task: 'quick',
    title: 'DAC or AOC at 25G?',
    text: 'What is the maximum length of a 25G DAC, and when should I switch to AOC or optics?',
    produces: ['answer'],
    level: 'quick',
  },
];

export const FEATURED_PROMPTS = PROMPTS.filter((p) => p.featured);

export function findPrompt(id: string): LibraryPrompt {
  const prompt = PROMPTS.find((p) => p.id === id);
  if (!prompt) throw new Error(`Unknown prompt id: ${id}`);
  return prompt;
}
