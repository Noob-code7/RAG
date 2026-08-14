import { Link } from 'react-router-dom';

export default function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-primary-container py-32">
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="relative z-10 mx-auto max-w-4xl px-md text-center">
        <h2 data-reveal className="mb-lg font-display-lg text-display-lg text-on-primary">
          Turn your documents into a verifiable knowledge base.
        </h2>
        <Link
          data-reveal
          to="/"
          className="mt-lg inline-block rounded bg-surface px-xl py-md font-label-caps text-label-caps text-primary transition-colors hover:bg-surface-container-highest"
        >
          Start Grounding Today
        </Link>
      </div>
    </section>
  );
}