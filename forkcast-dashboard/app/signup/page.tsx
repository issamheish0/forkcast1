"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { toast } from "react-hot-toast"
import { Loader2, UserPlus } from "lucide-react"
//import { RegistrationTermsCheckbox } from "@/components/ui/terms-checkbox"
import { strongPasswordSchema, STAFF_MIN_LENGTH } from "@/lib/validators/password"
import { checkPasswordBreach } from "@/lib/validators/password-breach"

// Lebanese phone number validation regex - just check for 8 digits
const lebanesePhoneRegex = /^\d{8}$/

const formSchema = z.object({
  // Staff details
  fullName: z
    .string()
    .min(2, "Please enter at least 2 characters.")
    .max(50, "Please enter fewer than 50 characters.")
    .regex(
      /^[a-zA-Z\s\u0600-\u06FF\u002D\u0027]+$/,
      "Please enter a valid name.",
    ),
  email: z
    .string()
    .email("Please enter a valid email address.")
    .toLowerCase(),
  phoneNumber: z
    .string()
    .regex(lebanesePhoneRegex, "Please enter a valid 8-digit Lebanese phone number.")
    .transform((val) => {
      // Normalize phone number format - always add +961 prefix
      const cleaned = val.trim()
      // Remove all non-digit characters
      const digits = cleaned.replace(/\D/g, '')
      
      // Should be exactly 8 digits after validation
      return `+961${digits}`
    }),
  password: strongPasswordSchema,
  confirmPassword: z.string().min(STAFF_MIN_LENGTH, "Please confirm your password."),
  
 
  
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type FormData = z.infer<typeof formSchema>

export default function SignUpPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const getVerificationRedirectUrl = () => {
    if (typeof window === "undefined") return ""

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
    const baseUrl = appUrl || "http://rbs-restaurant.vercel.app"
    return `${baseUrl.replace(/\/$/, "")}/verify-otp`
  }

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
     
    },
  })

  async function onSubmit(data: FormData) {
    try {
      setIsLoading(true)

      const breach = await checkPasswordBreach(data.password)
      if (!breach.ok) {
        const reason = (breach as any).reason
        form.setError("password", { type: "manual", message: reason })
        toast.error(reason)
        return
      }

      // Create user account with OTP verification
      const verificationRedirectUrl = getVerificationRedirectUrl()
      console.debug("Signup verification redirect target:", verificationRedirectUrl)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone_number: data.phoneNumber,
          },
          emailRedirectTo: verificationRedirectUrl,
        },
      })

      if (authError) {
        console.error("Sign-up error:", authError)

        if (authError.message?.toLowerCase().includes("rate limit") || authError.message?.toLowerCase().includes("over_email_send_rate_limit")) {
          toast.error("Too many signup attempts. Please wait a few minutes before trying again.")
          return
        }

        if (authError.message?.toLowerCase().includes("already registered") || authError.message?.toLowerCase().includes("repeated signup")) {
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email: data.email,
          })

          if (resendError) throw resendError

          toast.success("Account already exists. We sent a new verification email.")
          router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`)
          return
        }

        throw authError
      }
      if (!authData.user) throw new Error("Failed to create account")

      // Upsert profile (update if exists, insert if doesn't)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: authData.user.id,
          full_name: data.fullName,
          email: data.email,
          phone_number: data.phoneNumber,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.error("Profile update error:", profileError)
        // Don't throw here as the user account was created successfully
      }

      // Show success message
      toast.success("Account created! Check your email for verification code.")

      // Redirect to OTP verification page with email
      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`)
    } catch (error: any) {
      console.error("Sign-up error:", error)
      
      // Show user-friendly error messages
      let errorMessage = "An error occurred during sign up."
      
      if (error.message?.includes("already registered")) {
        errorMessage = "This email is already registered. Please sign in instead."
      } else if (error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("over_email_send_rate_limit")) {
        errorMessage = "Too many signup attempts. Please wait a few minutes before trying again."
      } else if (error.message?.includes("weak password")) {
        errorMessage = "Please choose a stronger password."
      } else if (error.message?.includes("invalid email")) {
        errorMessage = "Please enter a valid email address."
      } else if (error.message?.includes("phone")) {
        errorMessage = "Please enter a valid Lebanese phone number."
      }

      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full border-2 shadow-xl backdrop-blur-md bg-white/20 border-white/30">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">
                Create Account
              </CardTitle>
   
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="03 123 456 or 71 234 567"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <PasswordInput
                              placeholder="••••••••"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <PasswordInput
                              placeholder="••••••••"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                 
                  

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading }
                    size="sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <div className="text-sm text-secondary-foreground text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </Card>
  )
}
