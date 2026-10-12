// Language-independent data
export const REPO = 'whetstone-dev/rack-cabling-designer';
export const REPO_URL = `https://github.com/${REPO}`;
export const INSTALL_CMD = `npx skills add ${REPO}`;
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const ORG_URL = 'https://whetstone-dev.github.io/';

// Outputs written by `rackcab build` (served from public/examples/<example>/)
export const OUTPUT_FILES = ['elevation.html', 'README.md', 'cable-schedule.csv', 'labels.csv', 'bom.csv', 'power.md', 'report.json'] as const;
export type OutputFile = (typeof OUTPUT_FILES)[number];

export function exampleUrl(example: string, file: string): string {
  return `${BASE_PATH}/examples/${example}/${file}`;
}

// The 38 rule codes by family, as listed in references/model.md. Colors follow the equipment palette.
export const RULE_FAMILIES = [
  { key: 'RACK', color: 'blue', codes: ['RCD-RACK-POSITION', 'RCD-RACK-BOUNDS', 'RCD-RACK-OVERLAP', 'RCD-RACK-DEPTH', 'RCD-RACK-WEIGHT', 'RCD-RACK-UTIL', 'RCD-RACK-2POST'] },
  { key: 'AIR', color: 'teal', codes: ['RCD-AIR-RECIRC', 'RCD-AIR-SIDE', 'RCD-AIR-BLANKING', 'RCD-AIR-DATA'] },
  { key: 'PWR', color: 'orange', codes: ['RCD-PWR-OUTLET', 'RCD-PWR-INLET', 'RCD-PWR-CONNECTOR', 'RCD-PWR-RACK', 'RCD-PWR-DATA', 'RCD-PWR-UNPOWERED', 'RCD-PWR-REDUNDANCY', 'RCD-PWR-CAPACITY', 'RCD-PWR-FAILOVER'] },
  { key: 'CBL', color: 'green', codes: ['RCD-CBL-SELF', 'RCD-CBL-SIDE', 'RCD-CBL-PORT', 'RCD-CBL-PORT-REUSE', 'RCD-CBL-MEDIA', 'RCD-CBL-LENGTH-MISSING', 'RCD-CBL-MIXED', 'RCD-CBL-SPEED', 'RCD-CBL-REACH', 'RCD-CBL-CHANNEL', 'RCD-CBL-OPTIC'] },
  { key: 'LBL', color: 'violet', codes: ['RCD-LBL-MISSING', 'RCD-LBL-DUP', 'RCD-LBL-PATTERN', 'RCD-LBL-COLOR'] },
  { key: 'MODEL', color: 'rose', codes: ['RCD-SCHEMA', 'RCD-DUP-ID', 'RCD-REF'] },
] as const;
export type RuleFamilyKey = (typeof RULE_FAMILIES)[number]['key'];
export const RULE_COUNT = RULE_FAMILIES.reduce((n, f) => n + f.codes.length, 0);

/** Family of a finding code: RCD-PWR-CAPACITY → PWR; schema and identity codes → MODEL */
export function familyOf(code: string): RuleFamilyKey {
  const key = code.split('-')[1];
  return (RULE_FAMILIES.find((f) => f.key === key)?.key ?? 'MODEL') as RuleFamilyKey;
}

// Other projects of the organization, shown in "More from whetstone"
export const WHETSTONE_PROJECTS = [
  { slug: 'network-engineering', url: 'https://whetstone-dev.github.io/network-engineering/', color: 'blue' },
  { slug: 'whetstone-dev.github.io', url: ORG_URL, color: 'teal' },
] as const;
