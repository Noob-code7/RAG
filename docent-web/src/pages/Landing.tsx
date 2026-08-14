import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import Quote from '../components/landing/Quote';
import FinalCta from '../components/landing/FinalCta';
import Footer from '../components/landing/Footer';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Buttery-smooth scrolling via Lenis, wired into GSAP's ticker so
      // ScrollTrigger stays perfectly in sync.
      const lenis = new Lenis({ lerp: 0.09, anchors: true });
      lenis.on('scroll', () => ScrollTrigger.update());
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      if (!prefersReduced) {
        // Generic directional reveals driven by data attributes.
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
          const dir = el.dataset.reveal ?? 'up';
          const from: gsap.TweenVars = { opacity: 0, x: 0, y: 0 };
          if (dir === 'up') from.y = 48;
          else if (dir === 'left') from.x = -48;
          else if (dir === 'right') from.x = 48;
          gsap.fromTo(el, from, {
            opacity: 1,
            x: 0,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          });
        });

        // Staggered card groups.
        gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
          gsap.fromTo(
            group.querySelectorAll('[data-reveal-item]'),
            { opacity: 0, y: 56 },
            {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: 'power3.out',
              stagger: 0.14,
              scrollTrigger: { trigger: group, start: 'top 82%', once: true },
            },
          );
        });
      }

      return () => {
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="overflow-x-clip bg-surface font-body-ui text-on-surface antialiased">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Quote />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}