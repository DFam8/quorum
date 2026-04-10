import { generateAuthenticationOptions } from '@simplewebauthn/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const rpID = new URL(getRequestURL(event).origin).hostname

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    // Empty allowCredentials = discoverable credentials (usernameless flow).
    // Browser shows all available passkeys registered for this origin.
    allowCredentials: [],
  })

  // Persist the challenge for verification
  const session = await useSession(event, { password: config.sessionPassword })
  await session.update({ passkeyAuthChallenge: options.challenge })

  return options
})
