"use client"

import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Shield, FileText, Mail, Phone, MapPin, Heart } from "lucide-react"

interface FooterProps {
  variant?: "auth" | "dashboard" | "public"
  className?: string
}

export function Footer({ variant = "public", className = "" }: FooterProps) {
  const currentYear = new Date().getFullYear()

  if (variant === "dashboard") {
    // Minimal footer for dashboard pages
    return (
      <footer className={`mt-auto py-4 px-4 border-t border-border/40 ${className}`}>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground text-sm"><div className="flex items-center gap-4">
            <span>© {currentYear} Plate by Qwerty App</span>
            <Separator orientation="vertical" className="h-4" />
            <Link href="/terms" target="_blank" className="hover:text-foreground transition-colors flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Terms
            </Link>
            <Link href="/privacy" target="_blank" className="hover:text-foreground transition-colors flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Privacy
            </Link>
          </div>
          <div className="text-xs">
            Made with <Heart className="h-3 w-3 inline text-red-500" /> for restaurants
          </div>
        </div>
      </footer>
    )
  }

  if (variant === "auth") {
    // Footer for authentication pages
    return (
      <footer className={`mt-4 py-4 ${className}`}>
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 text-sm">
            {/* Main links */}
            <div className="flex items-center gap-8">
              <Link href="/terms" target="_blank" className="text-white/80 hover:text-white transition-colors flex items-center gap-2 hover:underline">
                <FileText className="h-4 w-4" />
                Terms & Conditions
              </Link>
              <Link href="/privacy" target="_blank" className="text-white/80 hover:text-white transition-colors flex items-center gap-2 hover:underline">
                <Shield className="h-4 w-4" />
                Privacy Policy
              </Link>
              <Link href="mailto:support@plate.app" className="text-white/80 hover:text-white transition-colors flex items-center gap-2 hover:underline">
                <Mail className="h-4 w-4" />
                Support
              </Link>
            </div>
            
            {/* Divider */}
            <div className="w-24 h-px bg-white/20"></div>
            
            {/* Copyright and tagline */}
            <div className="text-center space-y-2">
              <p className="text-white/90 font-medium">© {currentYear} Plate by Qwerty App</p>
              <p className="text-white/60 text-xs">Secure, compliant, and built for restaurants</p>
            </div>
          </div>
        </div>
      </footer>
    )
  }

  // Full footer for public pages
  return (
    <footer className={`bg-muted/30 border-t border-border/40 ${className}`}>
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Plate</h3>
            <p className="text-sm text-muted-foreground text-sm">Restaurant reservation platform for modern diners. Discover restaurants, make bookings, and enjoy amazing dining experiences.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground text-sm"><div className="flex items-center gap-2">
                <span><strong>By:</strong> Qwerty App</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>support@plate.app</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>legal@qwertyapp.com</span>
              </div>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Product</h3>
            <div className="space-y-2 text-sm">
              <Link href="/features" className="block text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link href="/pricing" className="block text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="/demo" className="block text-muted-foreground hover:text-foreground transition-colors">
                Request Demo
              </Link>
              <Link href="/integrations" className="block text-muted-foreground hover:text-foreground transition-colors">
                Integrations
              </Link>
            </div>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Support</h3>
            <div className="space-y-2 text-sm">
              <Link href="/help" className="block text-muted-foreground hover:text-foreground transition-colors">
                Help Center
              </Link>
              <Link href="/docs" className="block text-muted-foreground hover:text-foreground transition-colors">
                Documentation
              </Link>
              <Link href="/contact" className="block text-muted-foreground hover:text-foreground transition-colors">
                Contact Us
              </Link>
              <Link href="/status" className="block text-muted-foreground hover:text-foreground transition-colors">
                System Status
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Legal</h3>
            <div className="space-y-2 text-sm">
              <Link 
                href="/terms" 
                target="_blank"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="h-3 w-3" />
                Terms & Conditions
              </Link>
              <Link 
                href="/privacy" 
                target="_blank"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Shield className="h-3 w-3" />
                Privacy Policy
              </Link>
              <Link href="/cookies" className="block text-muted-foreground hover:text-foreground transition-colors">
                Cookie Policy
              </Link>
              <Link href="/gdpr" className="block text-muted-foreground hover:text-foreground transition-colors">
                GDPR Compliance
              </Link>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground text-sm"><div className="flex items-center gap-4">
            <span>© {currentYear} Plate by Qwerty App. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Made with</span>
            <Heart className="h-4 w-4 text-red-500" />
            <span>for restaurants worldwide</span>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground text-sm"><p>This platform complies with GDPR, CCPA, and other applicable privacy regulations.</p>
          <p>All data is encrypted and stored securely. We never sell your information.</p>
        </div>
      </div>
    </footer>
  )
}
