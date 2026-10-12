import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary, SectionHead as SectionHeadCopy } from '@/i18n/types';
import type { LibraryPrompt } from '@/content/prompts';
import { PROMPT_TASKS } from '@/content/prompts';
import { rich } from '@/lib/rich';
import { OUTPUT_FILES, RULE_FAMILIES, WHETSTONE_PROJECTS, exampleUrl, type OutputFile, type RuleFamilyKey } from '@/lib/site';
import type { StageFinding } from '@/lib/stage';
import { CopyButton } from './CopyButton';
import {
  AirIcon, ArrowUpRightIcon, BoltIcon, BracesIcon, CableIcon, ChartIcon, DocIcon, GridIcon, ListIcon, RackIcon, TagIcon,
} from './Icons';

interface HeadProps {
  num: string;
  head: SectionHeadCopy;
}

// Section heading: the number sits in a rack-unit tag, like a U label on the rail
export function SectionHead({ num, head }: HeadProps) {
  return (
    <div className="head reveal">
      <p className="eyebrow">
        <span className="u-tag" aria-hidden="true">U{num}</span>
        {head.tag}
      </p>
      <h2>{rich(head.title)}</h2>
      {head.sub ? <p className="sub">{rich(head.sub)}</p> : null}
    </div>
  );
}

const FAMILY_ICONS: Record<RuleFamilyKey, ReactNode> = {
  RACK: <RackIcon />, AIR: <AirIcon />, PWR: <BoltIcon />, CBL: <CableIcon />, LBL: <TagIcon />, MODEL: <BracesIcon />,
};

/** The six rule families, each with a real finding from the broken example (or the schema typo) */
export function Checks({ t, samples }: { t: Dictionary['checks']; samples: Partial<Record<RuleFamilyKey, StageFinding>> }) {
  return (
    <>
      <div className="checks">
        {RULE_FAMILIES.map((f, i) => {
          const copy = t.families[f.key];
          const sample = samples[f.key];
          return (
            <article className="check glass reveal" key={f.key} data-c={f.color} style={{ '--i': i % 3 } as CSSProperties}>
              <div className="check-top">
                <span className="ico">{FAMILY_ICONS[f.key]}</span>
                <span className="check-count"><b>{f.codes.length}</b> {t.rules}</span>
              </div>
              <h3>{copy.title}</h3>
              <p>{copy.body}</p>
              {sample ? (
                <div className="finding-line" data-sev={sample.severity}>
                  <span className="fl-label">{t.sample}</span>
                  <code>{sample.code}</code>
                  <span className="fl-msg">{sample.message}</span>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      <p className="checks-note reveal">{rich(t.sources)}</p>
    </>
  );
}

const OUTPUT_ICONS: Record<OutputFile, ReactNode> = {
  'elevation.html': <RackIcon />, 'README.md': <DocIcon />, 'cable-schedule.csv': <GridIcon />, 'labels.csv': <TagIcon />,
  'bom.csv': <ListIcon />, 'power.md': <ChartIcon />, 'report.json': <BracesIcon />,
};

const OUTPUT_COLORS: Record<OutputFile, string> = {
  'elevation.html': 'blue', 'README.md': 'teal', 'cable-schedule.csv': 'green', 'labels.csv': 'violet',
  'bom.csv': 'amber', 'power.md': 'orange', 'report.json': 'rose',
};

/** One model on the left, every generated file on the right (links to the real outputs) */
export function Outputs({ t }: { t: Dictionary['outputs'] }) {
  const example = 'datacenter-pod';
  return (
    <div className="outputs">
      <div className="model-win reveal">
        <div className="win-bar">
          <span className="dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="win-title">{t.modelTitle}</span>
          <a className="win-link" href={exampleUrl(example, `${example}.rack.json`)} download aria-label={`${t.open} ${t.modelTitle}`}>
            <ArrowUpRightIcon />
          </a>
        </div>
        <pre className="model-code">
          <span className="t-d">{'{'}</span>{'\n'}
          {'  '}<span className="t-k">&quot;$schema&quot;</span>: <span className="t-v">&quot;…/rack-model-1.schema.json&quot;</span>,{'\n'}
          {'  '}<span className="t-k">&quot;meta&quot;</span>: {'{ '}<span className="t-k">&quot;name&quot;</span>: <span className="t-v">&quot;Data hall pod A&quot;</span>, <span className="t-k">&quot;status&quot;</span>: <span className="t-v">&quot;design&quot;</span>{' }'},{'\n'}
          {'  '}<span className="t-k">&quot;policy&quot;</span>: {'{ '}<span className="t-k">&quot;powerDerating&quot;</span>: <span className="t-n">0.8</span>, <span className="t-k">&quot;labelPattern&quot;</span>: <span className="t-v">&quot;^DC1-\\d{'{4}'}$&quot;</span>{' }'},{'\n'}
          {'  '}<span className="t-k">&quot;racks&quot;</span>: [{'{ '}<span className="t-k">&quot;id&quot;</span>: <span className="t-v">&quot;A01&quot;</span>, <span className="t-k">&quot;heightU&quot;</span>: <span className="t-n">42</span>, <span className="t-k">&quot;depthMm&quot;</span>: <span className="t-n">1200</span>{' }'}],{'\n'}
          {'  '}<span className="t-k">&quot;devices&quot;</span>: [{'{ '}<span className="t-k">&quot;id&quot;</span>: <span className="t-v">&quot;srv01&quot;</span>, <span className="t-k">&quot;type&quot;</span>: <span className="t-v">&quot;generic-server-1u&quot;</span>, <span className="t-d">…</span>{' }'}],{'\n'}
          {'  '}<span className="t-k">&quot;pdus&quot;</span>: [{'{ '}<span className="t-k">&quot;id&quot;</span>: <span className="t-v">&quot;a01-pdu-a&quot;</span>, <span className="t-k">&quot;feed&quot;</span>: <span className="t-v">&quot;A&quot;</span>, <span className="t-k">&quot;maxAmps&quot;</span>: <span className="t-n">32</span>{' }'}],{'\n'}
          {'  '}<span className="t-k">&quot;powerLinks&quot;</span>: [{'{ '}<span className="t-k">&quot;device&quot;</span>: <span className="t-v">&quot;srv01&quot;</span>, <span className="t-k">&quot;pdu&quot;</span>: <span className="t-v">&quot;a01-pdu-a&quot;</span>{' }'}],{'\n'}
          {'  '}<span className="t-k">&quot;cables&quot;</span>: [{'{ '}<span className="t-k">&quot;id&quot;</span>: <span className="t-v">&quot;d01&quot;</span>, <span className="t-k">&quot;media&quot;</span>: <span className="t-v">&quot;dac&quot;</span>, <span className="t-k">&quot;lengthM&quot;</span>: <span className="t-n">2</span>, <span className="t-d">…</span>{' }'}]{'\n'}
          <span className="t-d">{'}'}</span>
        </pre>
        <p className="model-note">{t.modelNote}</p>
      </div>

      <div className="out-arrow reveal" aria-hidden="true">
        <span>{t.from}</span>
      </div>

      <ul className="out-list">
        {OUTPUT_FILES.map((file, i) => (
          <li key={file} className="reveal" style={{ '--i': i } as CSSProperties}>
            <a className="out-row" href={exampleUrl(example, file)} target="_blank" rel="noopener noreferrer" data-c={OUTPUT_COLORS[file]}>
              <span className="ico">{OUTPUT_ICONS[file]}</span>
              <span className="out-text">
                <code>{file}</code>
                <span>{t.files[file]}</span>
              </span>
              <ArrowUpRightIcon className="out-go" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PROMPT_COPY = { es: { label: 'Copiar prompt', done: 'Copiado al portapapeles', failed: 'No se pudo copiar' }, en: { label: 'Copy prompt', done: 'Copied to clipboard', failed: 'Could not copy' } };

/** Featured prompts from the library, translated on the Spanish page */
export function FeaturedPrompts({ prompts, t, lang }: { prompts: LibraryPrompt[]; t: Dictionary['prompts']; lang: Locale }) {
  return (
    <>
      <div className="fprompts">
        {prompts.map((p, i) => {
          const task = PROMPT_TASKS.find((x) => x.key === p.task);
          const copy = lang === 'es' && p.es ? p.es : { title: p.title, text: p.text };
          return (
            <article className="fprompt glass reveal" key={p.id} data-c={task?.color} style={{ '--i': i % 3 } as CSSProperties}>
              <p className="fp-task"><i aria-hidden="true" />{task?.label}</p>
              <h3>{copy.title}</h3>
              <p className="fp-text">
                <span className="fp-mark" aria-hidden="true">›</span>
                {copy.text}
              </p>
              <div className="fp-foot">
                <span className="fp-produces">
                  {t.produces}: {p.produces.map((x) => <code key={x}>{x}</code>)}
                </span>
                <CopyButton text={copy.text} labels={PROMPT_COPY[lang]} />
              </div>
            </article>
          );
        })}
      </div>
      <div className="fprompts-more reveal">
        <Link className="btn btn-glass" href={`/${lang}/docs/prompts/`}>{t.all} <span aria-hidden="true">→</span></Link>
      </div>
    </>
  );
}

export function Compat({ t }: { t: Dictionary['install'] }) {
  return (
    <div className="compat glass reveal">
      <h3>{t.compatTitle}</h3>
      <ul>
        {t.compat.map((c) => (
          <li key={c.name} data-status={c.status}>
            <span className="cp-name">{c.name}</span>
            <span className="cp-badge"><i aria-hidden="true" />{c.label}</span>
            <span className="cp-note">{c.note}</span>
          </li>
        ))}
      </ul>
      <div className="reqs">
        {t.reqs.map((r) => <span className="chip" key={r}>{r}</span>)}
      </div>
    </div>
  );
}

export function More({ t }: { t: Dictionary['more'] }) {
  return (
    <div className="more">
      {WHETSTONE_PROJECTS.map((p, i) => {
        const copy = t.projects[p.slug];
        return (
          <a key={p.slug} className="more-card glass reveal" href={p.url} data-c={p.color} style={{ '--i': i } as CSSProperties}>
            <span className="more-kind">{copy.kind}</span>
            <strong>{copy.title}</strong>
            <span className="more-body">{copy.body}</span>
            <span className="more-go">{t.visit} <ArrowUpRightIcon /></span>
          </a>
        );
      })}
    </div>
  );
}
