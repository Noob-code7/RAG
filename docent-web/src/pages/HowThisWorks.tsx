import { useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import AppNavbar from '../components/app/AppNavbar';

gsap.registerPlugin(useGSAP);

const STEPS = [
  {
    n: '01',
    title: 'Chunk',
    icon: 'content_cut',
    body: 'Every uploaded PDF is parsed page by page and split into ~500-token chunks with a 50-token overlap. Chunks are the atomic unit of retrieval, so their size directly controls how granular an answer can be.',
  },
  {
    n: '02',
    title: 'Embed',
    icon: 'view_in_ar',
    body: 'Each chunk is embedded with OpenAI text-embedding-3-small into a 1536-dimension vector space, where semantically similar passages sit close together. Vectors are stored in Postgres via the pgvector extension.',
  },
  {
    n: '03',
    title: 'Retrieve',
    icon: 'manage_search',
    body: 'Your question is embedded the same way, and the top 8 most similar chunks are found by cosine similarity, then re-ranked down to the 4 most on-point passages. A confidence gate scores how well the evidence matches.',
  },
  {
    n: '04',
    title: 'Generate',
    icon: 'auto_awesome',
    body: 'The retrieved chunks are handed to the generation model as grounding context, with an instruction to cite the source IDs it draws on. Every citation in an answer links back to its page in the PDF.',
  },
];

const GUARDRAILS = [
  {
    icon: 'verified_user',
    title: 'Confidence gate',
    body: 'Similarity ≥ 0.40 grounds a full answer, 0.25–0.40 yields a partial answer, and anything below is refused outright — no fabrication.',
  },
  {
    icon: 'link',
    title: 'Inline citations',
    body: 'Answers render [1], [2] markers that hover-reveal the exact source document, page, and quoted passage.',
  },
  {
    icon: 'block',
    title: 'Saying no',
    body: 'When the evidence is too weak, Docent explicitly says it could not find the information rather than guessing.',
  },
];

export default function HowThisWorks() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.fromTo(
        '[data-hw-header]',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      );
      gsap.fromTo(
        '[data-hw-step]',
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 0.7, delay: 0.15, ease: 'power3.out', stagger: 0.1 },
      );
      gsap.fromTo(
        '[data-hw-guardrail]',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.5, ease: 'power3.out', stagger: 0.08 },
      );
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col bg-background font-body-ui text-on-background">
      <AppNavbar />
      <main className="mx-auto w-full max-w-[960px] flex-1 px-md pb-16 pt-24 md:px-lg">
        <div data-hw-header className="mb-xl">
          <h1 className="mb-sm font-display-lg text-display-lg text-on-surface">How Docent works</h1>
          <p className="max-w-2xl font-body-doc text-body-doc text-on-surface-variant">
            Docent answers questions about your documents using retrieval-augmented generation. Every answer
            is grounded in your sources, not the model&rsquo;s memory — here is the pipeline, end to end.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          {STEPS.map((step) => (
            <div
              key={step.n}
              data-hw-step
              className="flex flex-col rounded-lg border border-outline-variant bg-surface-container-lowest p-lg"
            >
              <div className="mb-md flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-high text-secondary">
                  <span className="material-symbols-outlined text-[22px]">{step.icon}</span>
                </div>
                <span className="font-display-lg text-[40px] font-bold leading-none text-outline-variant">
                  {step.n}
                </span>
              </div>
              <h2 className="mb-xs font-headline-md text-headline-md text-on-surface">{step.title}</h2>
              <p className="font-body-doc text-body-doc text-on-surface-variant">{step.body}</p>
            </div>
          ))}
        </div>

        <div data-hw-step className="mt-md rounded-lg border border-secondary/30 bg-secondary/5 p-lg">
          <div className="mb-sm flex items-center gap-sm">
            <span className="material-symbols-outlined text-secondary">shield</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Anti-hallucination guardrails</h2>
          </div>
          <div className="grid grid-cols-1 gap-md md:grid-cols-3">
            {GUARDRAILS.map((g) => (
              <div key={g.title} data-hw-guardrail className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md">
                <span className="material-symbols-outlined mb-sm text-[20px] text-secondary">{g.icon}</span>
                <h3 className="font-headline-sm text-[14px] text-on-surface">{g.title}</h3>
                <p className="mt-xs font-body-ui text-[12px] leading-5 text-on-surface-variant">{g.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div data-hw-header className="mt-xl flex flex-wrap items-center justify-between gap-md rounded-lg border border-outline-variant bg-surface-container-lowest p-lg">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Try it with your own documents</h2>
            <p className="mt-xs font-body-ui text-body-ui text-on-surface-variant">
              Upload a PDF and ask anything — answers come back with citations you can verify.
            </p>
          </div>
          <Link
            to="/notebooks"
            className="flex items-center gap-sm rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">folder</span>
            Open Notebooks
          </Link>
        </div>
      </main>
    </div>
  );
}