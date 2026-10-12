import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

/** Brand mark: a rack with three units, the middle one lit */
export const LogoIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <rect x="7" y="5.5" width="10" height="3" rx="1" fill="currentColor" opacity=".55" />
    <rect x="7" y="10.5" width="10" height="3" rx="1" fill="currentColor" />
    <rect x="7" y="15.5" width="10" height="3" rx="1" fill="currentColor" opacity=".55" />
  </svg>
);
export const MoonIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.8} {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
);
export const SunIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.8} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const CopyIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.8} {...p}><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></svg>
);
export const CheckIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={2.2} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const ArrowUpRightIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M7 17 17 7M9 7h8v8" /></svg>
);
export const DownloadIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
);
// Rule families
export const RackIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7.5h8M8 12h8M8 16.5h8" /></svg>
);
export const AirIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" /></svg>
);
export const BoltIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12z" /></svg>
);
export const CableIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><path d="M7 3v4M5 7h4v4a2 2 0 0 1-4 0zM7 13v2a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V9M15 5h4v4h-4z" /></svg>
);
export const TagIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
);
export const BracesIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><path d="M8 3H7a2 2 0 0 0-2 2v4l-2 3 2 3v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4l2 3-2 3v4a2 2 0 0 1-2 2h-1" /></svg>
);
// Output files
export const GridIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></svg>
);
export const DocIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>
);
export const ChartIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" /></svg>
);
export const ListIcon = (p: IconProps) => (
  <svg {...base} strokeWidth={1.9} {...p}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>
);
export const GithubIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" /></svg>
);
