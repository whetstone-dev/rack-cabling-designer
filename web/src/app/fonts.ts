import { Geist, Geist_Mono } from 'next/font/google';

// Fonts are self-hosted at build time (no requests to Google at runtime)
export const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
export const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const fontVars = `${sans.variable} ${mono.variable}`;

// Before first paint: applies the saved theme (no flash) and marks that JS runs, so scroll reveals
// only hide content when something will show it again.
export const THEME_SCRIPT = `document.documentElement.dataset.js='';try{var t=localStorage.getItem('rc-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;
