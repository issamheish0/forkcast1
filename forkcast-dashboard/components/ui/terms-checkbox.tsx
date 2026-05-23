"use client"

import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { ExternalLink, Shield, FileText } from "lucide-react"

interface TermsCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  required?: boolean
  className?: string
  variant?: "registration" | "customer" | "booking" | "newsletter"
  disabled?: boolean
}

export function TermsCheckbox({
  checked,
  onCheckedChange,
  required = true,
  className = "",
  variant = "registration",
  disabled = false
}: TermsCheckboxProps) {
  
  const getContent = () => {
    switch (variant) {
      case "registration":
        return {
          text: "I agree to the",
          links: [
            { href: "/terms", text: "Terms and Conditions" },
            { href: "/privacy", text: "Privacy Policy" }
          ],
          prefix: "By registering, "
        }
      
      case "customer":
        return {
          text: "I consent to the collection and processing of my personal data according to the",
          links: [
            { href: "/privacy", text: "Privacy Policy" }
          ],
          prefix: ""
        }
      
      case "booking":
        return {
          text: "I agree to the booking",
          links: [
            { href: "/terms", text: "Terms and Conditions" }
          ],
          prefix: ""
        }
      
      case "newsletter":
        return {
          text: "I agree to receive marketing communications and understand the",
          links: [
            { href: "/privacy", text: "Privacy Policy" }
          ],
          prefix: ""
        }
      
      default:
        return {
          text: "I agree to the",
          links: [
            { href: "/terms", text: "Terms and Conditions" },
            { href: "/privacy", text: "Privacy Policy" }
          ],
          prefix: ""
        }
    }
  }

  const content = getContent()

  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      <Checkbox
        id={`terms-checkbox-${variant}`}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-1"
        required={required}
      />
      <div className="grid gap-1.5 leading-none">
        <label
          htmlFor={`terms-checkbox-${variant}`}
          className="text-sm font-medium leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          <span className="text-muted-foreground text-sm">{content.prefix}
            {content.text}
          </span>
          {content.links.map((link, index) => (
            <span key={link.href}>
              {index > 0 && content.links.length > 1 && " and "}
              <Link
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline underline-offset-4 inline-flex items-center gap-1 font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {link.href === "/terms" && <FileText className="h-3 w-3" />}
                {link.href === "/privacy" && <Shield className="h-3 w-3" />}
                {link.text}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </span>
          ))}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {variant === "registration" && (
          <p className="text-xs text-muted-foreground text-sm">Required to create an account and use our services
          </p>
        )}
        {variant === "customer" && (
          <p className="text-xs text-muted-foreground text-sm">We use this information to provide better service and comply with legal requirements
          </p>
        )}
        {variant === "booking" && (
          <p className="text-xs text-muted-foreground text-sm">Includes cancellation policies and booking guidelines
          </p>
        )}
        {variant === "newsletter" && (
          <p className="text-xs text-muted-foreground text-sm">You can unsubscribe at any time
          </p>
        )}
      </div>
    </div>
  )
}

// Additional specialized components for specific use cases
export function RegistrationTermsCheckbox(props: Omit<TermsCheckboxProps, "variant">) {
  return <TermsCheckbox {...props} variant="registration" />
}

export function CustomerTermsCheckbox(props: Omit<TermsCheckboxProps, "variant">) {
  return <TermsCheckbox {...props} variant="customer" />
}

export function BookingTermsCheckbox(props: Omit<TermsCheckboxProps, "variant">) {
  return <TermsCheckbox {...props} variant="booking" />
}

export function NewsletterTermsCheckbox(props: Omit<TermsCheckboxProps, "variant">) {
  return <TermsCheckbox {...props} variant="newsletter" />
}
