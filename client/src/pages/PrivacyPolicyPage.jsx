import { Link } from 'react-router-dom';
import { PenMark } from '../components/PenMark.jsx';

const sectionHeading = 'font-serif text-lg text-charcoal';
const body = 'text-sm leading-relaxed text-charcoal/70';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
        <Link to="/" className="flex items-center gap-2">
          <PenMark className="h-6 w-6 text-indigo" />
          <span className="font-serif text-xl text-charcoal">Pairagraph</span>
        </Link>

        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-3xl text-charcoal">Privacy Policy</h1>
          <p className="text-xs text-charcoal/40">Last updated: July 28, 2026</p>
        </div>

        <p className={body}>
          Pairagraph is a small, independently run project. This policy explains what
          information is collected, why, and what control you have over it. It isn't written by
          a lawyer — it's a plain description of how the app actually works.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>What's collected</h2>
          <ul className={`${body} list-disc space-y-1 pl-5`}>
            <li>Your email address and display name, used to identify your account and send verification/reset emails.</li>
            <li>A hashed password (if you sign up with email/password) — the plain password is never stored. If you sign in with Google, no password is stored at all.</li>
            <li>The writing, chat messages, and keywords you create within collaborations.</li>
            <li>Basic technical logs (e.g. IP address) generated automatically by the hosting providers below, used only for rate-limiting and abuse prevention.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Who else sees it</h2>
          <p className={body}>
            Pairagraph runs on a handful of third-party services, each handling a specific piece
            of infrastructure:
          </p>
          <ul className={`${body} list-disc space-y-1 pl-5`}>
            <li><strong>MongoDB Atlas</strong> — stores account and collaboration data.</li>
            <li><strong>Render</strong> and <strong>Vercel</strong> — host the backend and frontend.</li>
            <li><strong>Brevo</strong> — delivers verification and password-reset emails.</li>
            <li><strong>Google</strong> — powers optional Google Sign-In and the AI-generated writing keywords (via Gemini).</li>
          </ul>
          <p className={body}>
            None of your data is sold, and none of it is used for advertising. Your writing and
            chat messages are visible only to you and the person you're paired with in that
            collaboration.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Your account, your control</h2>
          <p className={body}>
            From your Account page, you can update your display name, change your password, or
            delete your account entirely. Deleting your account removes your personal
            information (email, display name, password), but the text of collaborations you
            took part in stays visible to the other participant — the same way a message stays
            in someone else's inbox after you delete yours. Nothing you wrote becomes newly
            attributed to your name after deletion; it's shown as belonging to a removed user.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Cookies</h2>
          <p className={body}>
            Pairagraph uses two small, secure cookies to keep you signed in between visits.
            They aren't used for tracking or advertising, only for authentication.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Changes</h2>
          <p className={body}>
            If this policy changes in any meaningful way, the "last updated" date above will
            change too. Continuing to use Pairagraph after an update means you accept the
            revised policy.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Contact</h2>
          <p className={body}>
            Questions about this policy or your data can be sent to{' '}
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
