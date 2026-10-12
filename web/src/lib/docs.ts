import type { ComponentType } from 'react';

// Docs navigation. Order here = sidebar order = previous/next order.
export interface DocPage {
  slug: string;
  title: string;
  description: string;
  /** Minutes, shown in the page header */
  minutes?: number;
  /** Pages without content yet are listed as "Soon" and not generated */
  ready: boolean;
}

export interface DocGroup {
  title: string;
  color: 'blue' | 'teal' | 'violet' | 'amber' | 'rose' | 'green' | 'orange';
  pages: DocPage[];
}

export const DOC_GROUPS: DocGroup[] = [
  {
    title: 'Getting started',
    color: 'blue',
    pages: [
      { slug: 'introduction', title: 'Introduction', description: 'What the skill does, who it is for and why one model drives every output.', minutes: 3, ready: true },
      { slug: 'installation', title: 'Installation', description: 'Install for Claude Code, Codex, Cursor or any Agent Skills app; update, verify and uninstall.', minutes: 5, ready: true },
      { slug: 'quickstart', title: 'Quickstart', description: 'From a one-line request to a validated rack, its elevation and its BOM in five minutes.', minutes: 5, ready: true },
    ],
  },
  {
    title: 'Using the skill',
    color: 'violet',
    pages: [
      { slug: 'prompts', title: 'Prompt library', description: 'Ready-to-copy requests for every task: plan, cable, power, airflow, labels, BOM, audits and change plans.', minutes: 4, ready: true },
      { slug: 'writing-requests', title: 'Writing good requests', description: 'What to include so the skill models what you mean, and how it treats what you leave out.', minutes: 6, ready: true },
      { slug: 'workflow', title: 'The design workflow', description: 'Survey, model, validate, build and hand over: the five steps the skill follows and where you take part.', minutes: 6, ready: true },
    ],
  },
  {
    title: 'Model & toolkit',
    color: 'green',
    pages: [
      { slug: 'the-model', title: 'The rack model', description: 'The *.rack.json file: racks, devices, PDUs, power links, cables and policy, with the JSON Schema.', minutes: 8, ready: true },
      { slug: 'cli-reference', title: 'rackcab CLI', description: 'Every rackcab command, its flags, outputs and exit codes.', minutes: 6, ready: true },
      { slug: 'rules', title: 'Rule reference', description: 'All 38 RCD rules by family: what each one checks, its severity and how to fix it.', minutes: 10, ready: true },
      { slug: 'outputs', title: 'Generated outputs', description: 'What each file written by rackcab build contains and how installers use it.', minutes: 5, ready: true },
    ],
  },
  {
    title: 'Reference',
    color: 'orange',
    pages: [
      { slug: 'compatibility', title: 'Compatibility', description: 'Where the skill runs, what was verified on each assistant and the known limitations.', minutes: 4, ready: true },
      { slug: 'safety-and-limits', title: 'Safety & limits', description: 'What a passing validation means, what the skill does not model and how to share outputs safely.', minutes: 5, ready: true },
      { slug: 'faq', title: 'FAQ', description: 'Short answers to the questions people ask first.', minutes: 4, ready: true },
    ],
  },
];

export const ALL_PAGES: (DocPage & { group: DocGroup })[] = DOC_GROUPS.flatMap((g) => g.pages.map((p) => ({ ...p, group: g })));
export const READY_PAGES = ALL_PAGES.filter((p) => p.ready);

// Static map so the bundler knows every MDX file (no dynamic paths)
export const DOC_CONTENT: Record<string, () => Promise<{ default: ComponentType }>> = {
  introduction: () => import('@/content/docs/introduction.mdx'),
  installation: () => import('@/content/docs/installation.mdx'),
  quickstart: () => import('@/content/docs/quickstart.mdx'),
  prompts: () => import('@/content/docs/prompts.mdx'),
  'writing-requests': () => import('@/content/docs/writing-requests.mdx'),
  workflow: () => import('@/content/docs/workflow.mdx'),
  'the-model': () => import('@/content/docs/the-model.mdx'),
  'cli-reference': () => import('@/content/docs/cli-reference.mdx'),
  rules: () => import('@/content/docs/rules.mdx'),
  outputs: () => import('@/content/docs/outputs.mdx'),
  compatibility: () => import('@/content/docs/compatibility.mdx'),
  'safety-and-limits': () => import('@/content/docs/safety-and-limits.mdx'),
  faq: () => import('@/content/docs/faq.mdx'),
};

export function findPage(slug: string) {
  const i = READY_PAGES.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  return { page: READY_PAGES[i], prev: READY_PAGES[i - 1] ?? null, next: READY_PAGES[i + 1] ?? null };
}

export const DOCS_SOURCE_DIR = 'web/src/content/docs';
