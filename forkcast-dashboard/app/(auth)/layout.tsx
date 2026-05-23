// app/(auth)/layout.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Footer } from "@/components/layout/footer"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Middleware handles redirecting authenticated users away from auth pages to avoid loops

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] relative flex-col justify-between overflow-hidden shrink-0">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/auth-background.jpg')" }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/95 via-primary/80 to-primary/95" />
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center">
              <img src="/icon.png" alt="Forkcast" className="h-10 w-10 object-cover" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Forkcast</span>
          </div>

          {/* Hero Text */}
          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Your restaurant,<br />
              <span className="text-primary-foreground/70">simplified.</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed max-w-sm">
              Manage bookings, tables, orders, and your team — all from one powerful dashboard.
            </p>
            {/* Feature highlights */}
            <div className="flex flex-col gap-3 pt-2">
              {[
                "Real-time reservation management",
                "Smart table allocation",
                "Team & staff coordination",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60" />
                  <span className="text-white/60 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/40 text-xs">
            © {new Date().getFullYear()} Forkcast </p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0">
        {/* Mobile header */}
        <div className="lg:hidden px-6 pt-6 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg overflow-hidden">
              <img src="/icon.png" alt="Forkcast" className="h-9 w-9 object-cover" />
            </div>
            <span className="text-lg font-bold tracking-tight">Forkcast</span>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 sm:px-8 lg:px-12 xl:px-20">
          <div className="w-full max-w-[420px]">
            {children}
          </div>
        </div>
        <div className="lg:hidden">
          <Footer variant="auth" />
        </div>
      </div>
    </div>
  )
}
