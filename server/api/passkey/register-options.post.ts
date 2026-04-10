import { serverSupabaseUser } from '#supabase/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { passkeyCredential, resident } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser?.email) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const config = useRuntimeConfig()
  const origin = getRequestURL(event).origin
  const rpID = new URL(origin).hostname

  const res = await db.query.resident.findFirst({
    where: eq(resident.email, supabaseUser.email),
  })
  if (!res) throw createError({ statusCode: 404, message: 'Resident not found' })

  // Exclude credentials already registered on this account
  const existing = await db
    .select({ credentialId: passkeyCredential.credentialId, transports: passkeyCredential.transports })
    .from(passkeyCredential)
    .where(eq(passkeyCredential.residentId, res.id))

  const options = await generateRegistrationOptions({
    rpName: 'Quorum',
    rpID,
    userName: res.email,
    userDisplayName: `${res.firstName} ${res.lastName}`.trim(),
    attestation: 'none',
    authenticatorSelection: {
      residentKey: 'required',       // discoverable credential (usernameless sign-in)
      userVerification: 'required',  // require biometric / PIN
      authenticatorAttachment: 'platform', // Face ID, Touch ID, Windows Hello only
    },
    excludeCredentials: existing.map(c => ({
      id: c.credentialId,
      transports: (c.transports as AuthenticatorTransport[] | null) ?? [],
    })),
  })

  // Persist the challenge so we can verify the response
  const session = await useSession(event, { password: config.sessionPassword })
  await session.update({ passkeyChallenge: options.challenge, passkeyResidentId: res.id })

  return options
})
