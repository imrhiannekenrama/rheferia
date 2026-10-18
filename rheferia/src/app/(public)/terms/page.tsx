import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Terms of use</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Owner note: obtain legal review and configure contact details before launch.
      </p>

      <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="font-semibold text-foreground">Service description</h2>
          <p className="mt-1">
            Rheferia helps you find research and available full texts,
            build reference lists, and work with documents. It does not
            guarantee complete coverage of published research or access to
            any particular paper.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Your responsibilities</h2>
          <p className="mt-1">
            You are responsible for how you use retrieved sources, including
            copyright, licensing, and the accuracy of citations you submit.
            Only convert documents you are authorized to use.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-foreground">No warranty</h2>
          <p className="mt-1">
            The service is provided &quot;as is&quot; without warranties of
            fitness for a particular purpose. Provider metadata may be
            incomplete or out of date.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Contact</h2>
          <p className="mt-1">
            [Owner: configure a contact address before launching this site.]
          </p>
        </div>
      </section>
    </main>
  );
}
