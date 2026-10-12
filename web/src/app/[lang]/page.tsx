import Link from 'next/link';
import { getDictionary, isLocale } from '@/i18n/config';
import { FEATURED_PROMPTS } from '@/content/prompts';
import stageJson from '@/generated/stage.json';
import { rich } from '@/lib/rich';
import { INSTALL_CMD, ORG_URL, REPO, REPO_URL, familyOf, type RuleFamilyKey } from '@/lib/site';
import type { StageData, StageFinding } from '@/lib/stage';
import { VERSION } from '@/lib/version';
import { CopyCommand } from '@/components/CopyCommand';
import { GithubIcon } from '@/components/Icons';
import { Install } from '@/components/Install';
import { Nav } from '@/components/Nav';
import { RackStage } from '@/components/RackStage';
import { RevealObserver } from '@/components/RevealObserver';
import { Checks, Compat, FeaturedPrompts, More, Outputs, SectionHead } from '@/components/Sections';

const stage = stageJson as StageData;

// One real finding per rule family: the first (worst) one from the broken example, plus the schema typo
function familySamples(): Partial<Record<RuleFamilyKey, StageFinding>> {
  const out: Partial<Record<RuleFamilyKey, StageFinding>> = {};
  const broken = stage.examples.find((e) => e.name === 'broken-rack');
  for (const f of broken?.findings ?? []) {
    const key = familyOf(f.code);
    if (!out[key]) out[key] = f;
  }
  out.MODEL = stage.schemaSample.find((f) => f.message.includes('did you mean')) ?? stage.schemaSample[0];
  return out;
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) throw new Error(`Unsupported language: ${lang}`);
  const t = getDictionary(lang);

  return (
    <>
      <Nav lang={lang} t={t.nav} />
      <main id="top">
        {/* ============ Hero: copy + the interactive rack ============ */}
        <section className="hero">
          <div className="hero-light" aria-hidden="true"><i /><i /><i /></div>
          <div className="hero-rails" aria-hidden="true" />
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <a className="pill-badge" href={`${REPO_URL}/releases`} target="_blank" rel="noopener noreferrer">
                <b>v{VERSION}</b> {t.hero.badge} <span className="arrow" aria-hidden="true">→</span>
              </a>
              <h1>
                {t.hero.title} <span className="h1-accent">{t.hero.titleAccent}</span>
              </h1>
              <p className="lede">{rich(t.hero.lede)}</p>
              <div className="install-row">
                <CopyCommand cmd={INSTALL_CMD} highlight={REPO} copy={t.copy} />
                <Link className="btn btn-glass" href={`/${lang}/docs/quickstart/`}>{t.hero.readDocs} <span aria-hidden="true">→</span></Link>
              </div>
              <ul className="facts">
                {t.hero.facts.map((f) => <li key={f}><i aria-hidden="true" />{f}</li>)}
              </ul>
            </div>
            <div className="hero-stage">
              <RackStage examples={stage.examples} t={t.stage} initial={1} />
            </div>
          </div>
        </section>

        {/* ============ U01 What it checks ============ */}
        <section className="block" id="checks">
          <div className="wrap">
            <SectionHead num="01" head={t.checks} />
            <Checks t={t.checks} samples={familySamples()} />
          </div>
        </section>

        {/* ============ U02 One model, every output ============ */}
        <section className="block" id="outputs">
          <div className="wrap">
            <SectionHead num="02" head={t.outputs} />
            <Outputs t={t.outputs} />
          </div>
        </section>

        {/* ============ U03 Prompts ============ */}
        <section className="block" id="prompts">
          <div className="wrap">
            <SectionHead num="03" head={t.prompts} />
            <FeaturedPrompts prompts={FEATURED_PROMPTS} t={t.prompts} lang={lang} />
          </div>
        </section>

        {/* ============ U04 Install ============ */}
        <section className="block" id="install">
          <div className="wrap">
            <SectionHead num="04" head={t.install} />
            <div className="install">
              <Install t={t.install} copy={t.copy} />
              <Compat t={t.install} />
            </div>
          </div>
        </section>

        {/* ============ U05 More from whetstone ============ */}
        <section className="block" id="more">
          <div className="wrap">
            <SectionHead num="05" head={t.more} />
            <More t={t.more} />

            <div className="cta-wrap reveal" id="cta">
              <div className="cta-light" aria-hidden="true"><i /><i /><i /></div>
              <div className="cta">
                <h2>{rich(t.cta.title)}</h2>
                <div className="install-row">
                  <CopyCommand cmd={INSTALL_CMD} highlight={REPO} copy={t.copy} />
                  <a className="btn btn-primary" href={REPO_URL} target="_blank" rel="noopener noreferrer"><GithubIcon /> {t.cta.github}</a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>
            v{VERSION} · MIT · © Juan David (Juanfrxz) · {t.footer.partOf} <a className="org-link" href={ORG_URL}><b>&gt;_</b> whetstone</a>
          </span>
          <nav aria-label={t.footer.linksLabel}>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href={`${REPO_URL}/blob/main/CHANGELOG.md`} target="_blank" rel="noopener noreferrer">{t.footer.changelog}</a>
            <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer">{t.footer.contributing}</a>
            <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">{t.footer.license}</a>
          </nav>
        </div>
      </footer>
      <RevealObserver />
    </>
  );
}
