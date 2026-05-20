import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Convert a hex string to a Uint8Array for timing-safe comparison
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

// Perform constant-time cryptographic signature comparison to avoid side-channel timing attacks
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  let result = 0
  for (let i = 0; i < a.byteLength; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

async function verifyDodoSignature(
  rawBody: string,
  headers: Headers,
  webhookSecret: string
): Promise<boolean> {
  const dodoSignature = headers.get('dodo-signature') || headers.get('Dodo-Signature')

  if (!dodoSignature) {
    console.warn('[DODO_WEBHOOK] Missing Dodo-Signature header')
    return false
  }

  try {
    const parts = dodoSignature.split(',')
    let timestamp = ''
    let signature = ''
    for (const part of parts) {
      const [key, val] = part.split('=')
      if (key === 't') timestamp = val
      if (key === 'v1') signature = val
    }

    if (!timestamp || !signature) {
      console.warn('[DODO_WEBHOOK] Invalid Dodo-Signature header format')
      return false
    }

    const encoder = new TextEncoder()
    const signedContent = `${timestamp}.${rawBody}`

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(signedContent)
    )

    const computedSignatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const incomingBytes = hexToBytes(signature)
    const computedBytes = hexToBytes(computedSignatureHex)

    return timingSafeEqual(incomingBytes, computedBytes)
  } catch (err) {
    console.error('[DODO_WEBHOOK] Cryptographic verification failed:', err)
    return false
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const webhookSecret = Deno.env.get('DODO_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('[DODO_WEBHOOK] System Configuration Error: DODO_WEBHOOK_SECRET is not set!')
    return new Response(
      JSON.stringify({ error: 'Webhook secret is not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Keep the raw text payload intact for signature checks
    const rawBody = await req.text()
    
    // Verify the incoming request authenticity
    const isValid = await verifyDodoSignature(rawBody, req.headers, webhookSecret)
    if (!isValid) {
      console.warn('[DODO_WEBHOOK] Verification failed: Rejecting with 401 Unauthorized')
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload = JSON.parse(rawBody)
    const eventType = payload.type || payload.event_type
    console.log(`[DODO_WEBHOOK] Received authenticated event: ${eventType}`)

    const supportedEvents = ['subscription.active', 'subscription.updated', 'payment.succeeded']
    if (!supportedEvents.includes(eventType)) {
      console.log(`[DODO_WEBHOOK] Ignoring unsupported event type: ${eventType}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Event logged and ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const eventData = payload.data
    if (!eventData) {
      throw new Error('Event data payload is empty')
    }

    // Extract custom metadata keys passed in static pricing links
    const metadata = eventData.metadata || {}
    const userId = metadata.user_id || metadata.metadata_user_id || metadata.userId || metadata.metadata_userId
    const plan = metadata.plan || metadata.metadata_plan
    const email = metadata.email || metadata.metadata_email

    if (!userId) {
      console.warn('[DODO_WEBHOOK] Missing userId in metadata: cannot map plan')
      return new Response(
        JSON.stringify({ error: 'Missing userId in metadata' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract payload values for the audit log
    const paymentId = eventData.payment_id || eventData.id || eventData.transaction_id || ''
    const subscriptionId = eventData.subscription_id || (eventType.startsWith('subscription') ? eventData.id : '') || ''
    const amount = eventData.amount || eventData.total_amount || eventData.price || null
    const currency = eventData.currency || null
    const status = eventData.status || ''

    // Insert payment audit log using the service_role key to bypass RLS
    const { error: logError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        payment_id: String(paymentId),
        subscription_id: String(subscriptionId),
        amount: amount !== null ? Number(amount) : null,
        currency: currency ? String(currency) : null,
        status: String(status),
        event_type: eventType,
        payload: payload
      })

    if (logError) {
      console.error('[DODO_WEBHOOK] Failed to log payment audit record:', logError)
    } else {
      console.log('[DODO_WEBHOOK] Successfully inserted payment audit log.')
    }

    // Map plans dynamically to correct database fields
    let mappedPlan = 'Starter'
    const isInactive = ['cancelled', 'expired', 'unpaid', 'failed', 'paused'].includes(String(status).toLowerCase())

    if (plan && !isInactive) {
      const p = String(plan).toLowerCase()
      if (p.includes('pro')) {
        mappedPlan = 'Career Pro'
      } else if (p.includes('elite')) {
        mappedPlan = 'Career Elite'
      } else if (p.includes('automation')) {
        mappedPlan = 'Automation'
      }
    }

    console.log(`[DODO_WEBHOOK] Syncing user ${userId} (${email || 'No email'}) to plan: ${mappedPlan}`)

    // Update profiles table in Supabase
    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .update({ plan: mappedPlan })
      .eq('id', userId)
      .select()
      .maybeSingle()

    if (dbError) {
      console.error('[DODO_WEBHOOK] Database plan mutation failed:', dbError)
      throw dbError
    }

    if (!profile) {
      console.warn(`[DODO_WEBHOOK] Warning: No profile record found for user_id ${userId}`)
    } else {
      console.log(`[DODO_WEBHOOK] Successfully synced profile for user ${userId} to ${mappedPlan}`)
    }

    return new Response(
      JSON.stringify({ success: true, userId, updatedPlan: mappedPlan }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[DODO_WEBHOOK] Internal processing error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
