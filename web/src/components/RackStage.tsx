'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Dictionary } from '@/i18n/types';
import type { Severity, StageExample, StageFinding, StageRack, StageUnit } from '@/lib/stage';
import { exampleUrl } from '@/lib/site';
import { ArrowUpRightIcon, DownloadIcon } from './Icons';
import { Segmented } from './Segmented';

type Face = 'front' | 'rear';
type ExampleName = keyof Dictionary['stage']['examples'];

interface RackStageProps {
  examples: StageExample[];
  t: Dictionary['stage'];
  /** Index of the example shown first */
  initial?: number;
}

interface Pop {
  rackId: string;
  unitId: string;
  /** Position inside .stage-body, already resolved to a side */
  x: number;
  y: number;
  side: 'right' | 'left';
}

const POP_WIDTH = 248;
const HOVER_DELAY = 140;
const RACK_MAX_PX = 520;

function facesOf(u: StageUnit): Face[] {
  return u.fullDepth ? ['front', 'rear'] : [u.face];
}

/** Unit height in px so the tallest rack of an example fits the stage */
function unitHeight(racks: StageRack[]): number {
  const tallest = Math.max(...racks.map((r) => r.heightU));
  return Math.max(9, Math.min(24, Math.floor(RACK_MAX_PX / tallest)));
}

function uRange(u: StageUnit): string {
  return u.heightU > 1 ? `U${u.startU}–U${u.startU + u.heightU - 1}` : `U${u.startU}`;
}

/** Units that share a U on a face, drawn as a collision band like the real elevation */
function collisions(rack: StageRack, face: Face): number[] {
  const count = new Map<number, number>();
  for (const u of rack.units) {
    if (!facesOf(u).includes(face)) continue;
    for (let n = u.startU; n < u.startU + u.heightU; n++) count.set(n, (count.get(n) ?? 0) + 1);
  }
  return [...count].filter(([n, c]) => c > 1 && n >= 1 && n <= rack.heightU).map(([n]) => n);
}

export function RackStage({ examples, t, initial = 1 }: RackStageProps) {
  const [index, setIndex] = useState(initial);
  const [shown, setShown] = useState(initial);
  const [view, setView] = useState<Face>('front');
  const [selected, setSelected] = useState<number | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [pinned, setPinned] = useState(false);
  const [instant, setInstant] = useState(false);
  const [ready, setReady] = useState(false);
  const [settled, setSettled] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const switchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ex = examples[shown];
  const uh = useMemo(() => unitHeight(ex.racks), [ex]);
  const finding: StageFinding | null = selected === null ? null : (ex.findings[selected] ?? null);
  const unitsById = useMemo(() => {
    const map = new Map<string, StageUnit>();
    for (const r of ex.racks) for (const u of r.units) map.set(u.id, u);
    return map;
  }, [ex]);
  const findingsByUnit = useMemo(() => {
    const map = new Map<string, StageFinding[]>();
    for (const f of ex.findings) for (const id of f.units) map.set(id, [...(map.get(id) ?? []), f]);
    return map;
  }, [ex]);

  // First entrance: units cascade in once, then delays are dropped so hover feedback is immediate
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    const timer = setTimeout(() => setSettled(true), 1400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  useEffect(
    () => () => {
      clearTimeout(hoverTimer.current);
      clearTimeout(leaveTimer.current);
      clearTimeout(switchTimer.current);
    },
    [],
  );

  const closePop = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setPop(null);
    setPinned(false);
    // Tooltips opened right after another one skip the delay; the window closes shortly after
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setInstant(false), 320);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      closePop();
      setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePop]);

  function selectExample(i: number): void {
    if (i === index) return;
    setIndex(i);
    closePop();
    setSelected(null);
    // Crossfade: the old racks blur out, the new ones come in (masks the swap of two different drawings)
    bodyRef.current?.setAttribute('data-switching', 'true');
    clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => {
      setShown(i);
      setView('front');
      requestAnimationFrame(() => bodyRef.current?.removeAttribute('data-switching'));
    }, 170);
  }

  function selectView(face: Face): void {
    closePop();
    setView(face);
  }

  function placePop(el: HTMLElement, rackId: string, unitId: string): Pop | null {
    const body = bodyRef.current;
    if (!body) return null;
    const b = body.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const y = Math.min(Math.max(r.top - b.top + r.height / 2, 60), b.height - 60);
    const fitsRight = r.right - b.left + 12 + POP_WIDTH <= b.width;
    return fitsRight
      ? { rackId, unitId, x: r.right - b.left + 10, y, side: 'right' }
      : { rackId, unitId, x: Math.max(r.left - b.left - 10, POP_WIDTH), y, side: 'left' };
  }

  function showPop(el: HTMLElement, rackId: string, unitId: string, immediate: boolean): void {
    clearTimeout(hoverTimer.current);
    clearTimeout(leaveTimer.current);
    const open = (): void => {
      const next = placePop(el, rackId, unitId);
      if (next) {
        setPop(next);
        setInstant(true);
      }
    };
    if (immediate || instant) open();
    else hoverTimer.current = setTimeout(open, HOVER_DELAY);
  }

  function hidePop(): void {
    if (pinned) return;
    clearTimeout(hoverTimer.current);
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(closePop, 90);
  }

  function toggleFinding(i: number): void {
    closePop();
    if (selected === i) {
      setSelected(null);
      return;
    }
    setSelected(i);
    // If everything the finding points at is on the other face, turn the rack around
    const f = ex.findings[i];
    const units = f.units.map((id) => unitsById.get(id)).filter((u): u is StageUnit => !!u);
    if (units.length > 0 && units.every((u) => !facesOf(u).includes(view))) setView(view === 'front' ? 'rear' : 'front');
  }

  const popUnit = pop ? unitsById.get(pop.unitId) : undefined;
  const popFindings = pop ? (findingsByUnit.get(pop.unitId) ?? []) : [];
  const failed = ex.counts.error > 0;
  const name = ex.name as ExampleName;

  function renderFace(rack: StageRack, face: Face) {
    const clash = collisions(rack, face);
    const step = uh >= 15 ? 1 : 5;
    return (
      <div className="rk-face" data-face={face} aria-hidden={face !== view}>
        <div className="rk-nums" aria-hidden="true">
          {Array.from({ length: rack.heightU }, (_, i) => i + 1)
            .filter((n) => n === 1 || n % step === 0 || n === rack.heightU)
            .map((n) => (
              <span key={n} style={{ '--s': n - 1 } as CSSProperties}>{n}</span>
            ))}
        </div>
        <div className="rk-frame">
          {(['left', 'right'] as const).map((side) => (
            <div className="rk-rail" data-side={side} key={side}>
              {rack.sidePdus
                .filter((p) => p.side === side)
                .map((p) => {
                  const sev = findingsByUnit.get(p.id)?.reduce<Severity | undefined>((w, f) => (w === 'error' ? w : f.severity === 'error' ? 'error' : w ?? f.severity), undefined);
                  const dim = finding ? !finding.units.includes(p.id) : false;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="rk-pdu"
                      data-sev={sev}
                      data-dim={dim || undefined}
                      tabIndex={face === view ? 0 : -1}
                      aria-label={`${p.label} · 0U ${p.side} · ${t.feed} ${p.feed}`}
                      onPointerEnter={(e) => e.pointerType === 'mouse' && showPop(e.currentTarget, rack.id, p.id, false)}
                      onPointerLeave={hidePop}
                      onFocus={(e) => showPop(e.currentTarget, rack.id, p.id, true)}
                      onBlur={hidePop}
                      onClick={(e) => {
                        setPinned(true);
                        showPop(e.currentTarget, rack.id, p.id, true);
                      }}
                    >
                      <span>{p.feed}</span>
                    </button>
                  );
                })}
            </div>
          ))}
          <div className="rk-body">
            {clash.map((n) => (
              <i key={`c${n}`} className="rk-clash" style={{ '--s': n - 1 } as CSSProperties} aria-hidden="true" />
            ))}
            {rack.units
              .filter((u) => facesOf(u).includes(face))
              .map((u, i) => {
                const back = u.face !== face;
                const out = u.startU + u.heightU - 1 > rack.heightU || u.startU < 1;
                const hot = finding ? finding.units.includes(u.id) : false;
                const isOpen = pop?.unitId === u.id && face === view;
                return (
                  <button
                    key={u.id}
                    type="button"
                    className="unit"
                    data-cat={u.category}
                    data-sev={u.severity}
                    data-back={back || undefined}
                    data-out={out || undefined}
                    data-hot={hot || undefined}
                    data-dim={finding && !hot ? true : undefined}
                    aria-expanded={isOpen}
                    tabIndex={face === view ? 0 : -1}
                    style={{ '--s': u.startU - 1, '--h': u.heightU, '--i': i } as CSSProperties}
                    aria-label={`${u.label}, ${uRange(u)}${back ? `, ${t.rearOf}` : ''}${u.severity ? `, ${u.severity}` : ''}`}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && showPop(e.currentTarget, rack.id, u.id, false)}
                    onPointerLeave={hidePop}
                    onFocus={(e) => showPop(e.currentTarget, rack.id, u.id, true)}
                    onBlur={hidePop}
                    onClick={(e) => {
                      if (pinned && pop?.unitId === u.id) {
                        closePop();
                        return;
                      }
                      setPinned(true);
                      showPop(e.currentTarget, rack.id, u.id, true);
                    }}
                  >
                    <span className="unit-label">{u.label}{back ? <small> ({t.rearOf})</small> : null}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage" data-ready={ready || undefined} data-settled={settled || undefined} role="group" aria-label={t.label}>
      <div className="stage-bar">
        <Segmented
          idPrefix="ex"
          ariaLabel={t.examplesLabel}
          selected={index}
          onSelect={selectExample}
          items={examples.map((e) => (
            <>
              <i className="ex-dot" data-bad={e.counts.error > 0 || undefined} aria-hidden="true" />
              {t.examples[e.name as ExampleName] ?? e.title}
            </>
          ))}
        />
        <Segmented
          idPrefix="face"
          className="seg-sm"
          ariaLabel={t.viewLabel}
          selected={view === 'front' ? 0 : 1}
          onSelect={(i) => selectView(i === 0 ? 'front' : 'rear')}
          items={[t.front, t.rear]}
        />
      </div>

      <div className="stage-body" ref={bodyRef} id="ex-panel" role="tabpanel" aria-labelledby={`ex-tab-${index}`}>
        <div className="stage-racks" data-view={view} style={{ '--uh': `${uh}px` } as CSSProperties}>
          {ex.racks.map((rack) => {
            const rackHot = finding?.racks.includes(rack.id) ?? false;
            return (
              <figure className="rk" key={`${ex.name}-${rack.id}`} data-hot={rackHot || undefined} style={{ '--H': rack.heightU } as CSSProperties}>
                <figcaption>
                  <b>{rack.name}</b>
                  <span>{rack.heightU}U{rack.depthMm ? ` · ${rack.depthMm} mm` : ''}{rack.loadW ? ` · ${(rack.loadW / 1000).toFixed(1)} kW` : ''}</span>
                </figcaption>
                <div className="rk-3d">
                  <div className="rk-flip">
                    {renderFace(rack, 'front')}
                    {renderFace(rack, 'rear')}
                  </div>
                </div>
              </figure>
            );
          })}
        </div>

        <aside className="stage-findings" aria-label={t.findings}>
          <div className="sf-head">
            <span className="sf-status" data-bad={failed || undefined}>
              <i aria-hidden="true" />
              {failed ? t.fail : t.pass}
            </span>
            <span className="sf-counts">
              <b data-sev="error">{ex.counts.error}</b> {t.errors} · <b data-sev="warning">{ex.counts.warning}</b> {t.warnings} · <b data-sev="info">{ex.counts.info}</b> {t.info}
            </span>
          </div>
          {ex.findings.length === 0 ? (
            <p className="sf-empty">{t.noFindings}</p>
          ) : (
            <ul className="sf-list">
              {ex.findings.map((f, i) => (
                <li key={`${f.code}-${i}`}>
                  <button type="button" className="sf-item" data-sev={f.severity} aria-pressed={selected === i} onClick={() => toggleFinding(i)}>
                    <code>{f.code}</code>
                    <span>{f.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="sf-hint">{t.hint}</p>
        </aside>

        {pop && popUnit ? (
          <div
            className="unit-pop"
            data-side={pop.side}
            data-instant={instant || undefined}
            role="tooltip"
            style={{ '--x': `${pop.x}px`, '--y': `${pop.y}px` } as CSSProperties}
            key={`${pop.rackId}-${pop.unitId}`}
          >
            <p className="up-title">
              <i data-cat={popUnit.category} aria-hidden="true" />
              {popUnit.label}
            </p>
            {popUnit.model ? <p className="up-model">{popUnit.model}</p> : null}
            <dl>
              <dt>U</dt>
              <dd>
                {uRange(popUnit)} · {popUnit.face}
                {popUnit.fullDepth ? ` · ${t.fullDepth}` : ''}
                {popUnit.startU + popUnit.heightU - 1 > (ex.racks.find((r) => r.id === pop.rackId)?.heightU ?? 0) ? ` · ${t.outOfRack}` : ''}
              </dd>
              {popUnit.loadW !== undefined ? (<><dt>{t.load}</dt><dd>{popUnit.loadW} W</dd></>) : null}
              {popUnit.weightKg !== undefined ? (<><dt>{t.weight}</dt><dd>{popUnit.weightKg} kg</dd></>) : null}
              {popUnit.airflow ? (<><dt>{t.airflow}</dt><dd>{popUnit.airflow}</dd></>) : null}
            </dl>
            {popFindings.length > 0 ? (
              <ul className="up-findings">
                {popFindings.slice(0, 4).map((f, i) => (
                  <li key={`${f.code}-${i}`} data-sev={f.severity}>{f.code}</li>
                ))}
                {popFindings.length > 4 ? <li>+{popFindings.length - 4}</li> : null}
              </ul>
            ) : null}
          </div>
        ) : null}
        {pop && !popUnit ? (
          (() => {
            const pdu = ex.racks.flatMap((r) => r.sidePdus).find((p) => p.id === pop.unitId);
            if (!pdu) return null;
            const fs = findingsByUnit.get(pdu.id) ?? [];
            return (
              <div className="unit-pop" data-side={pop.side} data-instant={instant || undefined} role="tooltip" style={{ '--x': `${pop.x}px`, '--y': `${pop.y}px` } as CSSProperties} key={pdu.id}>
                <p className="up-title"><i data-cat="pdu" aria-hidden="true" />{pdu.label}</p>
                <dl>
                  <dt>{t.feed}</dt><dd>{pdu.feed}</dd>
                  <dt>U</dt><dd>0U · {pdu.side}</dd>
                </dl>
                {fs.length > 0 ? (
                  <ul className="up-findings">
                    {fs.slice(0, 4).map((f, i) => <li key={`${f.code}-${i}`} data-sev={f.severity}>{f.code}</li>)}
                  </ul>
                ) : null}
              </div>
            );
          })()
        ) : null}
      </div>

      <div className="stage-foot">
        <span className="sfoot-totals">
          {ex.totals.racks} {t.racks} · {ex.totals.devices} {t.devices} · {ex.totals.cables} {t.cables} · {ex.totals.channels} {t.channels}
        </span>
        <span className="sfoot-links">
          <a href={exampleUrl(name, `${name}.rack.json`)} download className="sfoot-link">
            <DownloadIcon /> {t.downloadModel}
          </a>
          <a href={exampleUrl(name, 'elevation.html')} target="_blank" rel="noopener noreferrer" className="sfoot-link sfoot-primary">
            {t.openElevation} <ArrowUpRightIcon />
          </a>
        </span>
      </div>
    </div>
  );
}
