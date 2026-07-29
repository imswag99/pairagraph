import { Link } from 'react-router-dom';
import { PenMark } from '../components/PenMark.jsx';

const sectionHeading = 'font-serif text-lg text-charcoal';
const body = 'text-sm leading-relaxed text-charcoal/70';

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
        <Link to="/" className="flex items-center gap-2">
          <PenMark className="h-6 w-6 text-indigo" />
          <span className="font-serif text-xl text-charcoal">Pairagraph</span>
        </Link>

        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-3xl text-charcoal">Terms of Service</h1>
          <p className="text-xs text-charcoal/40">Last updated: July 28, 2026</p>
        </div>

        <p className={body}>
          Pairagraph is a small, independently run writing project, not a company with a legal
          team. These terms are written in plain language to set reasonable expectations for
          everyone using it.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Who can use Pairagraph</h2>
          <p className={body}>
            You must be at least 13 years old to create an account. By signing up, you confirm
            that the information you provide (email, display name) is accurate and that you'll
            keep your login credentials to yourself.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>How to treat your writing partner</h2>
          <p className={body}>
            Quick Match pairs you with someone you don't know. Treat them the way you'd want to
            be treated by a stranger: no harassment, hate speech, threats, spam, impersonation,
            or sharing anything illegal. Accounts used to do any of this can be suspended or
            removed without notice.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Your writing</h2>
          <p className={body}>
            Whatever you write on Pairagraph is yours. By posting it, you allow Pairagraph to
            store and display it as needed for the app to function — for example, showing it to
            the person you're collaborating with, and keeping it visible to them even if you
            later delete your own account.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>No promises about uptime</h2>
          <p className={body}>
            Pairagraph runs on free hosting tiers as a side project, not a funded product. It's
            provided "as is," without guarantees of uptime, data durability, or availability.
            Back up anything you'd be upset to lose.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Changes</h2>
          <p className={body}>
            These terms may change as the app evolves. The "last updated" date above will reflect
            any meaningful change, and continuing to use Pairagraph afterward means you accept
            the new terms.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Contact</h2>
          <p className={body}>
            Questions about these terms can be sent to{' '}
            <a
              href="mailto:pairagraph.app@gmail.com"
              className="text-indigo-dark underline decoration-indigo/30 underline-offset-4 hover:text-indigo"
            >
              pairagraph.app@gmail.com
            </a>
            .
          </p>
        </section>

        <Link
          to="/"
          className="mt-4 text-sm text-indigo-dark underline decoration-indigo/30 underline-offset-4 transition hover:text-indigo"
        >
          Back to Pairagraph
        </Link>
      </div>
    </div>
  );
}
