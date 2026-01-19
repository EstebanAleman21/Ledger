import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    // OAuth was denied or failed
    return NextResponse.redirect(new URL('/settings?error=auth_failed', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url))
  }

  try {
    // Exchange the code with our backend
    const response = await fetch(`${API_BASE}/auth/google/callback?code=${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OAuth callback error:', errorData)
      return NextResponse.redirect(new URL('/settings?error=exchange_failed', request.url))
    }

    const data = await response.json()
    
    // Redirect to settings with success
    // In a real app, you'd store the token in a session/cookie
    return NextResponse.redirect(new URL('/settings?auth=success', request.url))
  } catch (err) {
    console.error('OAuth callback exception:', err)
    return NextResponse.redirect(new URL('/settings?error=server_error', request.url))
  }
}
