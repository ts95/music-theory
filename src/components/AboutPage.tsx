interface AboutPageProps {
  onBack: () => void
}

/** Static "About" page explaining the spaced-repetition approach behind the études. */
export default function AboutPage({ onBack }: AboutPageProps) {
  return (
    <>
      <header className="mb-9">
        <button
          type="button"
          onClick={onBack}
          className="marking rise text-ink-3 transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          ← All études
        </button>

        <div className="rise mt-4">
          <p className="marking text-accent">About</p>
          <h1 className="mt-2 font-display text-[2.75rem] font-medium leading-[0.95] tracking-[-0.02em] text-ink sm:text-5xl">
            Spaced <span className="italic">Repetition</span>
          </h1>
          <p className="mt-2 text-ink-2">
            Why these études are scheduled the way they are.
          </p>
        </div>

        <div className="rise staff-rule mt-6" style={{ animationDelay: '80ms' }} />
      </header>

      <main
        className="rise space-y-8 leading-relaxed text-ink-2"
        style={{ animationDelay: '160ms' }}
      >
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-medium text-ink">
            The problem: we forget
          </h2>
          <p>
            In the 1880s Hermann Ebbinghaus mapped the <em>forgetting curve</em>:
            without review, freshly learned material fades within hours and days.
            Music theory is no exception — a fingering or a chord spelling learned
            once rarely stays put.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-medium text-ink">
            Two findings that <span className="italic">do</span> stick
          </h2>
          <p>
            Spaced repetition rests on two of the most replicated results in the
            science of learning:
          </p>
          <ul className="space-y-2">
            <li className="flex gap-3">
              <span aria-hidden className="text-accent">
                ♪
              </span>
              <span>
                <span className="text-ink">The spacing effect.</span> The same
                study time spread across several days builds far stronger
                long-term memory than the same time crammed into one sitting.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-accent">
                ♪
              </span>
              <span>
                <span className="text-ink">The testing effect.</span> Actively
                recalling an answer strengthens the memory more than re-reading
                the material — and it works best when recall is just hard enough
                to be effortful, a “desirable difficulty.”
              </span>
            </li>
          </ul>
          <p>
            A spacing algorithm decides <em>when</em> to review each fact so it
            lands at that effortful-but-possible moment, stretching the gap a
            little further every time you succeed.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-medium text-ink">
            How these études use it
          </h2>
          <ul className="space-y-2.5">
            <li className="flex gap-3">
              <span aria-hidden className="text-accent">
                ♪
              </span>
              <span>
                <span className="text-ink">Every fact is its own card.</span> A
                key’s relative minor, one scale’s spelling, a single fingering, a
                chord, an interval, a rhythm — each is scheduled independently.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-accent">
                ♪
              </span>
              <span>
                <span className="text-ink">A lightweight SM-2 scheduler</span>{' '}
                (the SuperMemo family) keeps an <em>ease</em>, an{' '}
                <em>interval</em>, and a <em>due date</em> per card. Answer
                correctly and the next review moves further out — days, then
                weeks; miss it and it comes back soon.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-accent">
                ♪
              </span>
              <span>
                <span className="text-ink">Recall, not re-reading.</span> Every
                question is multiple-choice with instant feedback, so each
                repetition is active retrieval practice.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-accent">
                ♪
              </span>
              <span>
                <span className="text-ink">Short, spaced sessions.</span> Each
                étude offers at most ten due cards every five hours, so practice
                stays bite-sized and naturally spread through the day rather than
                crammed.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-accent">
                ♪
              </span>
              <span>
                <span className="text-ink">Your progress stays with you.</span>{' '}
                The schedule is saved in this browser; Export / Import backs it up
                or moves it between devices.
              </span>
            </li>
          </ul>
        </section>

        <section className="space-y-2 border-t border-rule pt-5 text-sm text-ink-3">
          <p className="marking text-ink-3">Further reading</p>
          <p>
            Ebbinghaus, <em>Memory</em> (1885) — the forgetting curve. Cepeda et
            al. (2006) — a meta-analysis of distributed (spaced) practice. Roediger
            &amp; Karpicke (2006) — test-enhanced learning and retrieval practice.
          </p>
        </section>
      </main>
    </>
  )
}
