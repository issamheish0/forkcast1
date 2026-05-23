import Link from "next/link";

export default function Landing() {
  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-8 py-6">
        <span className="text-xl font-bold text-primary">ForkCast</span>
        <nav className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto mt-20 max-w-3xl px-6 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
          The booking dashboard your restaurant deserves.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Accept reservations, manage your floor, and never miss a guest. ForkCast
          turns incoming bookings into a clear, real-time workflow.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link
            href="/sign-up"
            className="rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:opacity-90"
          >
            Create restaurant account
          </Link>
          <Link
            href="/sign-in"
            className="rounded-xl border border-border bg-card px-6 py-3 text-base font-semibold text-foreground hover:bg-secondary"
          >
            I already have one
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-24 grid max-w-5xl gap-6 px-6 pb-20 sm:grid-cols-3">
        <Feature
          title="Real-time bookings"
          body="Incoming reservations from the mobile app appear instantly on your dashboard."
        />
        <Feature
          title="Accept or decline"
          body="One-click approval workflow for request-based bookings."
        />
        <Feature
          title="Always organized"
          body="Filter by date, status, and party size. Stay on top of every service."
        />
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
