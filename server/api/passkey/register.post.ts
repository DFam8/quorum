import { serverSupabaseUser } from '#supabase/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { community, passkeyCredential, resident } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser?.email) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const config = useRuntimeConfig()
  const session = await useSession(event, { password: config.sessionPassword })
  const { passkeyChallenge, passkeyResidentId } = session.data

  if (!passkeyChallenge || !passkeyResidentId) {
    throw createError({ statusCode: 400, message: 'No pending registration. Please start over.' })
  }

  const body = await readBody(event)
  const origin = getRequestURL(event).origin
  const rpID = new URL(origin).hostname

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: passkeyChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })
  } catch (err) {
    throw createError({ statusCode: 400, message: err instanceof Error ? err.message : 'Verification failed' })
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw createError({ statusCode: 400, message: 'Registration could not be verified.' })
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

  // Clear the challenge now that it's been used
  await session.update({ passkeyChallenge: null, passkeyResidentId: null })

  const res = await db.query.resident.findFirst({
    where: eq(resident.id, passkeyResidentId),
    with: { household: true },
  })
  if (!res) throw createError({ statusCode: 404, message: 'Resident not found' })

  const comm = await db.query.community.findFirst()
  if (!comm) throw createError({ statusCode: 500, message: 'Community not configured' })

  await db.insert(passkeyCredential).values({
    communityId: comm.id,
    residentId: res.id,
    credentialId: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: (credential.transports ?? []) as string[],
  })

  return { success: true }
})
