import { serverSupabaseServiceRole } from '#supabase/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { passkeyCredential, resident } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = await useSession(event, { password: config.sessionPassword })
  const { passkeyAuthChallenge } = session.data

  if (!passkeyAuthChallenge) {
    throw createError({ statusCode: 400, message: 'No pending authentication. Please start over.' })
  }

  const body = await readBody(event)
  const origin = getRequestURL(event).origin
  const rpID = new URL(origin).hostname

  // Look up the credential by ID so we have the public key + counter
  const stored = await db.query.passkeyCredential.findFirst({
    where: eq(passkeyCredential.credentialId, body.id),
    with: { resident: true },
  })

  if (!stored) {
    throw createError({ statusCode: 404, message: 'Passkey not recognised. Please sign in with email.' })
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: passkeyAuthChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: isoBase64URL.toBuffer(stored.publicKey),
        counter: stored.counter,
        transports: (stored.transports as AuthenticatorTransport[] | null) ?? [],
      },
    })
  } catch (err) {
    throw createError({ statusCode: 400, message: err instanceof Error ? err.message : 'Verification failed' })
  }

  if (!verification.verified) {
    throw createError({ statusCode: 401, message: 'Passkey verification failed.' })
  }

  // Clear challenge and update the counter (prevents replay attacks)
  await Promise.all([
    session.update({ passkeyAuthChallenge: null }),
    db.update(passkeyCredential)
      .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
      .where(eq(passkeyCredential.id, stored.id)),
  ])

  // Generate a one-time Supabase session token — no email sent
  const supabaseAdmin = serverSupabaseServiceRole(event)
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: stored.resident.email,
  })

  if (error || !data.properties?.email_otp) {
    throw createError({ statusCode: 500, message: 'Failed to create session. Please sign in with email.' })
  }

  // Return the OTP to the client; client calls supabase.auth.verifyOtp() to establish the session
  return {
    email: stored.resident.email,
    token: data.properties.email_otp,
  }
})
