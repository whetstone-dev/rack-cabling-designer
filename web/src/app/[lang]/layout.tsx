import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { getDictionary, isLocale, locales } from '@/i18n/config';
import { BASE_PATH } from '@/lib/site';
import { fontVars, THEME_SCRIPT } from '../fonts';
import '../globals.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const t = getDictionary(lang);
  return {
    metadataBase: new URL('https://whetstone-dev.github.io'),
    title: t.meta.title,
    description: t.meta.description,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${BASE_PATH}/${l}/`])) },
    openGraph: { title: t.meta.title, description: t.meta.description, type: 'website', locale: lang, images: [{ url: `${BASE_PATH}/og.png`, width: 1280, height: 640 }] },
    twitter: { card: 'summary_large_image', title: t.meta.title, description: t.meta.description, images: [`${BASE_PATH}/og.png`] },
    icons: { icon: [{ url: `${BASE_PATH}/icon.svg`, type: 'image/svg+xml' }] },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f4f8' },
    { media: '(prefers-color-scheme: dark)', color: '#07090e' },
  ],
};

export default async function LangLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) throw new Error(`Unsupported language: ${lang}`);
  return (
    <html lang={lang} className={fontVars} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Script id="theme" strategy="beforeInteractive">{THEME_SCRIPT}</Script>
        {children}
      </body>
    </html>
  );
}
