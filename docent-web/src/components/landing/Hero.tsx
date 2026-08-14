import { useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import WorkspacePreview from './WorkspacePreview';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function Hero() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      // Load-in: masked headline lines, subtitle, CTAs, then the visual.
      gsap.fromTo(
        '[data-hero-line]',
        { yPercent: 120 },
        { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.12, delay: 0.15 },
      );
      gsap.fromTo(
        '[data-hero-sub]',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.9, delay: 0.55, ease: 'power3.out' },
      );
      gsap.fromTo(
        '[data-hero-cta]',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.9, delay: 0.7, ease: 'power3.out', stagger: 0.1 },
      );
      gsap.fromTo(
        '[data-hero-visual]',
        { opacity: 0, y: 80, rotate: -5 },
        { opacity: 1, y: 0, rotate: -1.5, duration: 1.3, delay: 0.45, ease: 'power3.out' },
      );
      // Subtle parallax drift as the user scrolls past the hero.
      gsap.to('[data-hero-visual]', {
        yPercent: 14,
        ease: 'none',
        scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: true },
      });
    },
    { scope: ref },
  );

  return (
    <header ref={ref} className="relative overflow-hidden bg-grid-pattern pb-24 pt-32 sm:pb-32 sm:pt-40">
      <div className="relative z-10 mx-auto max-w-7xl px-md sm:px-lg lg:px-xl">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-lg font-display-lg text-display-lg text-on-surface">
            <span className="block overflow-hidden">
              <span data-hero-line className="block">
                Stop Hallucinating,
              </span>
            </span>
            <span className="block overflow-hidden">
              <span data-hero-line className="block">
                Start Grounding
              </span>
            </span>
          </h1>
          <p data-hero-sub className="mx-auto mb-xl max-w-2xl font-body-doc text-body-doc text-on-surface-variant">
            The professional-grade RAG platform for precision research. Upload PDFs, index your knowledge, and
            get answers with verifiable inline citations.
          </p>
          <div className="flex flex-col items-center justify-center gap-md sm:flex-row">
            <Link
              data-hero-cta
              to="/app"
              className="rounded bg-[#0F172A] px-xl py-md font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
            >
              Get Started
            </Link>
            <a
              data-hero-cta
              href="#features"
              className="flex items-center gap-sm rounded border border-[#CBD5E1] bg-transparent px-xl py-md font-label-caps text-label-caps text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[16px]">play_circle</span>
              Watch Demo
            </a>
          </div>
        </div>
        <WorkspacePreview />
      </div>
    </header>
  );
}