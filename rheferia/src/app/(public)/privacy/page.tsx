import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Owner note: configure contact details and legal review before launch.
      </p>

      <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="font-semibold text-foreground">Searches</h2>
          <p className="mt-1">
            Guest searches are rate limited by IP. Search history is stored
            only for signed-in accounts that explicitly enable it, stays
            private, and can be cleared at any time. Raw research queries
            are not logged into analytics.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Your research</h2>
          <p className="mt-1">
            Projects, notes, and reference lists belong to you. They are
            stored in a private database with row-level security so other
            accounts cannot read them. Files you upload for conversion are
            stored in private storage and expire on a schedule you are shown.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-foreground">External providers</h2>
          <p className="mt-1">
            Searches send your query to the research sources configured for
            this site (for example OpenAlex and Crossref). Cloud conversions
            send your selected file to the configured conversion provider.
            The interface tells you before either happens.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Deletion</h2>
          <p className="mt-1">
            You can export or delete your data from account settings.
            Deleting an account removes your records and private files
            through authorized operations. Where an external provider
            retains data under its own terms, this is documented honestly
            rather than promised away.
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
