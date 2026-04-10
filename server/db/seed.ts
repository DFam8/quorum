/**
 * Seed script — inserts sample polls (draft, open, closed) using the first
 * community and its accepted residents found in the database.
 *
 * Run with:  npm run db:seed
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env'), override: true })

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

const client = postgres(process.env.MIGRATION_URL ?? process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

async function insertPollWithOptions(
  communityId: string,
  createdBy: string,
  title: string,
  description: string | null,
  status: 'draft' | 'open' | 'closed',
  eligibility: 'all' | 'owners_only',
  anonymous: boolean,
  options: string[],
  closesAt?: Date,
  openedAt?: Date,
  closedAt?: Date,
): Promise<string> {
  const [p] = await db
    .insert(schema.poll)
    .values({
      communityId,
      createdBy,
      title,
      description,
      status,
      eligibility,
      anonymous,
      closesAt: closesAt ?? null,
      openedAt: openedAt ?? null,
      closedAt: closedAt ?? null,
    })
    .returning({ id: schema.poll.id })

  const pollId = p!.id

  await db.insert(schema.pollOption).values(
    options.map((label, i) => ({ pollId, label, displayOrder: i }))
  )

  return pollId
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  // 1. Find first community
  const communities = await db.select().from(schema.community).limit(1)
  if (!communities.length) {
    console.error('No community found — run migrations and create a community first.')
    process.exit(1)
  }
  const communityId = communities[0]!.id
  console.log(`Using community: ${communities[0]!.name} (${communityId})`)

  // 2. Find accepted residents to use as authors and voters
  const acceptedResidents = await db
    .select({ id: schema.resident.id, firstName: schema.resident.firstName, residentType: schema.resident.residentType })
    .from(schema.resident)
    .innerJoin(schema.household, eq(schema.resident.householdId, schema.household.id))
    .innerJoin(schema.unit, eq(schema.household.unitId, schema.unit.id))
    .where(eq(schema.unit.communityId, communityId))

  const allAccepted = acceptedResidents.filter((_, i) => i < 20) // cap to 20 for seeding

  if (!allAccepted.length) {
    console.error('No residents found — invite and accept at least one resident first.')
    process.exit(1)
  }

  const author = allAccepted[0]!
  console.log(`Using author: ${author.firstName} (${author.id})`)

  // 3. Guard — skip if polls already exist for this community
  const existing = await db
    .select({ id: schema.poll.id })
    .from(schema.poll)
    .where(eq(schema.poll.communityId, communityId))
    .limit(1)

  if (existing.length) {
    console.log('Polls already exist for this community — skipping seed.')
    await client.end()
    return
  }

  // 4. Insert polls ─────────────────────────────────────────────────────────

  // Draft
  await insertPollWithOptions(
    communityId, author.id,
    'Should we update the community landscaping design?',
    'The board is considering a new landscaping proposal for the common areas. We want your input before moving forward.',
    'draft', 'all', false,
    ['Yes, I support the proposal', 'No, keep the current design', 'I need more information before deciding'],
  )
  console.log('Created: draft poll')

  // Open — all residents, no close date
  const openPollId = await insertPollWithOptions(
    communityId, author.id,
    'What time should the pool close on weekdays?',
    'We are reviewing pool hours for the season. Please share your preference.',
    'open', 'all', false,
    ['8:00 PM', '9:00 PM', '10:00 PM', 'No change needed'],
    undefined,
    daysAgo(3),
  )
  console.log('Created: open poll (pool hours)')

  // Open — owners only, anonymous, closes in 7 days
  const openAnonymousPollId = await insertPollWithOptions(
    communityId, author.id,
    'Should we install EV charging stations in the parking garage?',
    'The board is exploring adding 4 Level-2 EV chargers. Installation cost would be covered by a special assessment. This poll is anonymous.',
    'open', 'owners_only', true,
    ['Yes — proceed with installation', 'No — I do not support this', 'Yes, but explore grants or incentives first'],
    daysFromNow(7),
    daysAgo(1),
  )
  console.log('Created: open poll (EV chargers, owners only, anonymous)')

  // Closed — with responses spread across options
  const closedPollId = await insertPollWithOptions(
    communityId, author.id,
    'Should we install security cameras in the parking lot?',
    'Following recent incidents, the board proposed installing 6 security cameras. Footage would be retained for 30 days.',
    'closed', 'all', false,
    ['Yes — install cameras', 'No — I have privacy concerns', 'Yes, but only at entry/exit points'],
    daysAgo(2),
    daysAgo(14),
    daysAgo(2),
  )
  console.log('Created: closed poll (security cameras)')

  // 5. Add responses to the open and closed polls ───────────────────────────

  const optionsByPoll = async (pollId: string) =>
    db.select().from(schema.pollOption).where(eq(schema.pollOption.pollId, pollId))

  // Responses for closed poll — spread across all voters
  if (allAccepted.length > 1) {
    const closedOptions = await optionsByPoll(closedPollId)
    const distribution = [0, 0, 1, 1, 2, 0, 1, 0, 2, 1, 0, 0, 1, 2, 0, 1, 0, 2, 1, 0]

    const closedVoters = allAccepted.slice(1) // author doesn't vote on their own poll in seed
    for (let i = 0; i < closedVoters.length; i++) {
      const voter = closedVoters[i]!
      const optionIndex = distribution[i % distribution.length]!
      const option = closedOptions[optionIndex % closedOptions.length]!
      await db.insert(schema.pollResponse).values({
        pollId: closedPollId,
        residentId: voter.id,
        optionId: option.id,
      }).onConflictDoNothing()
    }
    console.log(`Added ${closedVoters.length} response(s) to closed poll`)
  }

  // A few responses on the open pool-hours poll
  if (allAccepted.length > 1) {
    const openOptions = await optionsByPoll(openPollId)
    const voterSubset = allAccepted.slice(1, Math.min(5, allAccepted.length))
    const dist = [1, 2, 1, 0]
    for (let i = 0; i < voterSubset.length; i++) {
      const voter = voterSubset[i]!
      const option = openOptions[dist[i % dist.length]! % openOptions.length]!
      await db.insert(schema.pollResponse).values({
        pollId: openPollId,
        residentId: voter.id,
        optionId: option.id,
      }).onConflictDoNothing()
    }
    console.log(`Added ${voterSubset.length} response(s) to open poll`)
  }

  console.log('\nSeed complete.')
  await client.end()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
