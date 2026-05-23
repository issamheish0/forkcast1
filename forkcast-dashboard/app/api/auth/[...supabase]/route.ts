// app/api/auth/[...supabase]/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token = requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')

  // Handle both regular OAuth codes and PKCE tokens
  const authToken = code || token

  if (authToken) {
    const supabase = createRouteHandlerClient<any>({ cookies })

    try {
      let authResult: any

      // Handle PKCE tokens (from custom domains) vs regular OAuth codes
      if (token && token.startsWith('pkce_')) {
        // For PKCE tokens, use verifyOtp method
        authResult = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type === 'signup' ? 'signup' : 'email'
        })
      } else if (code) {
        // For regular OAuth codes, use exchangeCodeForSession
        authResult = await supabase.auth.exchangeCodeForSession(code)
      } else {
        throw new Error('Invalid token format')
      }

      const { data, error } = authResult

      if (error) {
        console.error('Error during authentication:', error)

        // Only redirect to error page for signup/confirmation flows
        if (type === 'signup' || type === 'email_confirm') {
          return NextResponse.redirect(`${requestUrl.origin}/email-confirmation-error?error=auth_error`)
        }

        // For other flows, redirect to login with error
        return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error`)
      }

      // Log successful authentication
      console.log('Successfully authenticated user:', {
        userId: data.user?.id,
        email: data.user?.email,
        type: type || 'login',
        tokenType: token?.startsWith('pkce_') ? 'PKCE' : 'OAuth'
      })

    } catch (error) {
      console.error('Unexpected error during authentication:', error)

      // Handle unexpected errors
      if (type === 'signup' || type === 'email_confirm') {
        return NextResponse.redirect(`${requestUrl.origin}/email-confirmation-error?error=auth_error`)
      }

      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error`)
    }
  }

  // Redirect based on flow type
  if (type === 'signup' || type === 'email_confirm') {
    return NextResponse.redirect(`${requestUrl.origin}/email-confirmed`)
  }

  // Default: redirect to bookings after successful authentication
  return NextResponse.redirect(`${requestUrl.origin}/bookings`)
}