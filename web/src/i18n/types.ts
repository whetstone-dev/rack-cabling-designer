// Contract every language must fulfill. Copy supports lightweight markup:
// {code|...} {b|...} {em|...} and, in terminal-style blocks, {d|...} {s|...} {ok|...} {er|...} {nt|...}

export interface SectionHead {
  tag: string;
  title: string;
  sub?: string;
}

export interface InstallTab {
  label: string;
  blocks: { comment: string; cmd: string; prompt: '$' | '>' }[];
  hint: string;
}

export interface Dictionary {
  meta: { title: string; description: string };
  nav: {
    checks: string;
    outputs: string;
    prompts: string;
    docs: string;
    install: string;
    installCta: string;
    themeLabel: string;
    languageLabel: string;
    sectionsLabel: string;
  };
  copy: { label: string; done: string; failed: string };
  hero: {
    badge: string;
    title: string;
    titleAccent: string;
    lede: string;
    readDocs: string;
    facts: string[];
  };
  stage: {
    label: string;
    examplesLabel: string;
    examples: Record<'small-office' | 'datacenter-pod' | 'broken-rack', string>;
    viewLabel: string;
    front: string;
    rear: string;
    findings: string;
    pass: string;
    fail: string;
    errors: string;
    warnings: string;
    info: string;
    noFindings: string;
    racks: string;
    devices: string;
    cables: string;
    channels: string;
    openElevation: string;
    downloadModel: string;
    rearOf: string;
    fullDepth: string;
    load: string;
    weight: string;
    airflow: string;
    feed: string;
    outOfRack: string;
    clear: string;
    hint: string;
  };
  checks: SectionHead & {
    families: Record<'RACK' | 'AIR' | 'PWR' | 'CBL' | 'LBL' | 'MODEL', { title: string; body: string }>;
    rules: string;
    sample: string;
    modelSample: string;
    sources: string;
  };
  outputs: SectionHead & {
    modelTitle: string;
    modelNote: string;
    files: Record<'elevation.html' | 'README.md' | 'cable-schedule.csv' | 'labels.csv' | 'bom.csv' | 'power.md' | 'report.json', string>;
    open: string;
    from: string;
  };
  prompts: SectionHead & { all: string; produces: string };
  install: SectionHead & {
    tablistLabel: string;
    tabs: InstallTab[];
    compatTitle: string;
    compat: { name: string; status: 'verified' | 'partial' | 'pending'; label: string; note: string }[];
    reqs: string[];
  };
  more: SectionHead & { projects: Record<'network-engineering' | 'whetstone-dev.github.io', { title: string; body: string; kind: string }>; visit: string };
  cta: { title: string; github: string };
  footer: { changelog: string; contributing: string; license: string; linksLabel: string; partOf: string };
  docs: {
    title: string;
    description: string;
    sidebarLabel: string;
    onThisPage: string;
    previous: string;
    next: string;
    edit: string;
    soon: string;
    menu: string;
    minutes: string;
    /** Shown when the docs content is not available in this language yet */
    notTranslated?: string;
  };
}
