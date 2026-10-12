'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { locales, type Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { REPO_URL } from '@/lib/site';
import { GithubIcon, LogoIcon, MoonIcon, SunIcon } from './Icons';

interface NavProps {
  lang: Locale;
  t: Dictionary['nav'];
}

function guardarPreferencia(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // No storage (private mode): the preference lasts only for this visit
  }
}

function temaActual(): 'dark' | 'light' {
  const forzado = document.documentElement.dataset.theme;
  if (forzado === 'dark' || forzado === 'light') return forzado;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function Nav({ lang, t }: NavProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function toggleTheme(): void {
    const next = temaActual() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    guardarPreferencia('rc-theme', next);
  }

  const pathname = usePathname() ?? `/${lang}/`;
  const enDocs = pathname.startsWith(`/${lang}/docs`);
  const enPrompts = pathname.startsWith(`/${lang}/docs/prompts`);
  // Absolute links so they also work from the docs pages
  const links = [
    { href: `/${lang}/#checks`, label: t.checks, c: 'blue' },
    { href: `/${lang}/#outputs`, label: t.outputs, c: 'green' },
    { href: `/${lang}/docs/prompts/`, label: t.prompts, c: 'violet', current: enPrompts },
    { href: `/${lang}/docs/`, label: t.docs, c: 'teal', current: enDocs && !enPrompts },
    { href: `/${lang}/#install`, label: t.install, c: 'orange' },
  ];
  // Switching language keeps the current page
  const enOtroIdioma = (l: string): string => pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${l}`);

  return (
    <header className="nav" data-scrolled={scrolled}>
      <div className="nav-glass" aria-hidden="true" />
      <div className="wrap">
        <Link className="brand" href={`/${lang}/`} aria-label="rack-cabling-designer">
          <span className="brand-mark"><LogoIcon /></span>
          <span className="brand-text">rack-cabling-designer</span>
        </Link>
        <nav className="nav-links" aria-label={t.sectionsLabel}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} data-c={l.c} aria-current={l.current ? 'page' : undefined}><i aria-hidden="true" />{l.label}</Link>
          ))}
        </nav>
        <a className="icon-btn" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <GithubIcon />
        </a>
        <div className="lang" role="group" aria-label={t.languageLabel}>
          {locales.map((l) => (
            <Link key={l} href={enOtroIdioma(l)} hrefLang={l} aria-current={l === lang} onClick={() => guardarPreferencia('rc-lang', l)}>
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
        <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={t.themeLabel}>
          <MoonIcon className="theme-moon" />
          <SunIcon className="theme-sun" />
        </button>
        <Link className="btn btn-primary" href={`/${lang}/#install`} aria-label={t.installCta}>
          {t.install}
        </Link>
      </div>
    </header>
  );
}
