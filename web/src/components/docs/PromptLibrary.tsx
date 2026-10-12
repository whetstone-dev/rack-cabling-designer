'use client';

import { useMemo, useState } from 'react';
import { PROMPTS, PROMPT_TASKS, type LibraryPrompt, type PromptTask } from '@/content/prompts';
import { CopyButton } from '../CopyButton';

const COPY_LABELS = { label: 'Copy prompt', done: 'Copied to clipboard', failed: 'Could not copy' };
const LEVEL_LABEL = { quick: 'Quick answer', design: 'Edits a model', project: 'Full deliverables' } as const;

/** One prompt as a card: task, title, the text with a copy button, what it produces and a tip */
export function PromptCard({ prompt }: { prompt: LibraryPrompt }) {
  const task = PROMPT_TASKS.find((t) => t.key === prompt.task);
  return (
    <article className="lib-card" id={`p-${prompt.id}`} data-c={task?.color}>
      <div className="lib-meta">
        <span className="lib-task"><i aria-hidden="true" />{task?.label}</span>
        <span className="lib-level" data-level={prompt.level}>{LEVEL_LABEL[prompt.level]}</span>
      </div>
      <h3 className="lib-title">{prompt.title}</h3>
      <div className="doc-prompt">
        <span className="doc-prompt-mark" aria-hidden="true">›</span>
        <p>{prompt.text}</p>
        <CopyButton text={prompt.text} labels={COPY_LABELS} />
      </div>
      <p className="lib-produces">
        You get: {prompt.produces.map((p) => <code key={p}>{p}</code>)}
      </p>
      {prompt.tip ? <p className="lib-tip">{prompt.tip}</p> : null}
    </article>
  );
}

/** Filterable library (docs page "prompts"). Filtering is repeated often, so results change without animation. */
export function PromptLibrary() {
  const [task, setTask] = useState<PromptTask | 'all'>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROMPTS.filter((p) => (task === 'all' || p.task === task) && (!q || `${p.title} ${p.text} ${p.produces.join(' ')}`.toLowerCase().includes(q)));
  }, [task, query]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of PROMPTS) map.set(p.task, (map.get(p.task) ?? 0) + 1);
    return map;
  }, []);

  function reset(): void {
    setTask('all');
    setQuery('');
  }

  return (
    <div className="lib">
      <div className="lib-controls">
        <div className="lib-filters" role="group" aria-label="Filter by task">
          <button type="button" className="lib-chip" aria-pressed={task === 'all'} onClick={() => setTask('all')}>
            All <span>{PROMPTS.length}</span>
          </button>
          {PROMPT_TASKS.map((t) => (
            <button type="button" key={t.key} className="lib-chip" data-c={t.color} aria-pressed={task === t.key} onClick={() => setTask(task === t.key ? 'all' : t.key)}>
              <i aria-hidden="true" />{t.label} <span>{counts.get(t.key) ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="lib-search">
          <span className="sr-only">Search prompts</span>
          <input type="search" placeholder="Search: PDU, fiber, labels…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <p className="lib-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'prompt' : 'prompts'}</p>
      <div className="lib-grid">
        {visible.map((p) => <PromptCard key={p.id} prompt={p} />)}
      </div>
      {visible.length === 0 ? (
        <p className="lib-empty">
          No prompt matches. Describe the task in your own words: the skill does not need a template.{' '}
          <button type="button" className="lib-reset" onClick={reset}>Show all prompts</button>
        </p>
      ) : null}
    </div>
  );
}
