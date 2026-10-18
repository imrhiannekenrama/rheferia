import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">404</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you requested does not exist or a source could not be resolved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to Rheferia
      </Link>
    </main>
  );
}
