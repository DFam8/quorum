import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, ne, and, isNull } from 'drizzle-orm'
import { router, superAdminProcedure } from '../procedures'
import {
  unit, household, resident, residentRole,
  announcement, document, notification, thread, message, meeting, agenda, minutes, minutesApproval,
  passkeyCredential, poll, pollOption, pollResponse, unitMaintenanceRequest,
} from '../../db/schema'

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_UNITS = [
  // Condos
  { unitNumber: '101', unitType: 'condo' as const, building: 'Building A', floor: 1 },
  { unitNumber: '102', unitType: 'condo' as const, building: 'Building A', floor: 1 },
  { unitNumber: '201', unitType: 'condo' as const, building: 'Building A', floor: 2 },
  { unitNumber: '202', unitType: 'condo' as const, building: 'Building A', floor: 2 },
  // Apartments
  { unitNumber: '10',  unitType: 'apartment' as const, building: 'Building B', floor: 1 },
  { unitNumber: '11',  unitType: 'apartment' as const, building: 'Building B', floor: 1 },
  { unitNumber: '20',  unitType: 'apartment' as const, building: 'Building B', floor: 2 },
  // SFHs
  { unitNumber: '123 Oak Street',    unitType: 'sfh' as const },
  { unitNumber: '456 Elm Avenue',    unitType: 'sfh' as const },
  { unitNumber: '789 Maple Drive',   unitType: 'sfh' as const },
]

type BoardRole = { role: 'board_member' | 'super_admin'; rank: number; title: string }

// accepted = completed onboarding; pending = still awaiting invite
// boardRole = assigned a community board role
const SEED_RESIDENTS: Array<{
  unitIndex: number; firstName: string; lastName: string; email: string
  residentType: 'owner' | 'renter'; status: 'accepted' | 'pending'; primary: boolean
  boardRole?: BoardRole
}> = [
  { unitIndex: 0, firstName: 'Alice',   lastName: 'Chen',    email: 'alice.chen@example.com',    residentType: 'owner',  status: 'accepted', primary: true,  boardRole: { role: 'board_member', rank: 2, title: 'Vice President' } },
  { unitIndex: 1, firstName: 'Bob',     lastName: 'Patel',   email: 'bob.patel@example.com',     residentType: 'owner',  status: 'accepted', primary: true  },
  { unitIndex: 1, firstName: 'Priya',   lastName: 'Patel',   email: 'priya.patel@example.com',   residentType: 'owner',  status: 'accepted', primary: false },
  { unitIndex: 2, firstName: 'Carlos',  lastName: 'Rivera',  email: 'carlos.r@example.com',      residentType: 'owner',  status: 'accepted', primary: true,  boardRole: { role: 'board_member', rank: 3, title: 'Treasurer'     } },
  { unitIndex: 3, firstName: 'Diana',   lastName: 'Foster',  email: 'diana.f@example.com',       residentType: 'renter', status: 'accepted', primary: true  },
  { unitIndex: 4, firstName: 'Ethan',   lastName: 'Moore',   email: 'ethan.m@example.com',       residentType: 'renter', status: 'accepted', primary: true  },
  { unitIndex: 5, firstName: 'Fatima',  lastName: 'Hassan',  email: 'fatima.h@example.com',      residentType: 'owner',  status: 'accepted', primary: true,  boardRole: { role: 'board_member', rank: 4, title: 'Board Member'  } },
  { unitIndex: 6, firstName: 'George',  lastName: 'Kim',     email: 'george.k@example.com',      residentType: 'renter', status: 'accepted', primary: true  },
  { unitIndex: 7, firstName: 'Hannah',  lastName: 'Lee',     email: 'hannah.l@example.com',      residentType: 'owner',  status: 'accepted', primary: true  },
  { unitIndex: 8, firstName: 'Ivan',    lastName: 'Torres',  email: 'ivan.t@example.com',        residentType: 'owner',  status: 'accepted', primary: true  },
  // Two left as pending to test the invite flow
  { unitIndex: 9, firstName: 'Julia',   lastName: 'Martin',  email: 'julia.m@example.com',       residentType: 'owner',  status: 'pending',  primary: true  },
  { unitIndex: 9, firstName: 'Marcus',  lastName: 'Martin',  email: 'marcus.m@example.com',      residentType: 'owner',  status: 'pending',  primary: false },
]

// ─── Router ───────────────────────────────────────────────────────────────────

export const devRouter = router({
  seed: superAdminProcedure.mutation(async ({ ctx }): Promise<{ unitsCreated: number; residentsCreated: number; skipped: number; pollsCreated: number; maintenanceCreated: number }> => {
    try {
      let unitsCreated = 0
      let residentsCreated = 0
      let maintenanceCreated = 0
      let skipped = 0
      let pollsCreated = 0

      const householdIds: string[] = []

      for (const u of SEED_UNITS) {
        const existing = await ctx.db.query.unit.findFirst({
          where: eq(unit.unitNumber, u.unitNumber),
        })

        if (existing) {
          const hh = await ctx.db.query.household.findFirst({
            where: eq(household.unitId, existing.id),
          })
          householdIds.push(hh?.id ?? '')
          skipped++
          continue
        }

        const [newUnit] = await ctx.db
          .insert(unit)
          .values({ communityId: ctx.communityId, ...u })
          .returning({ id: unit.id })

        if (!newUnit) { householdIds.push(''); continue }

        const [newHousehold] = await ctx.db
          .insert(household)
          .values({ unitId: newUnit.id })
          .returning({ id: household.id })

        householdIds.push(newHousehold?.id ?? '')
        unitsCreated++
      }

      const inviteExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      // Spread last-login times over the past 6 months for realism
      const now = Date.now()
      let loginOffset = 0

      for (const r of SEED_RESIDENTS) {
        const hhId = householdIds[r.unitIndex]
        if (!hhId) continue

        const already = await ctx.db.query.resident.findFirst({
          where: eq(resident.email, r.email),
        })
        if (already) { skipped++; continue }

        const isAccepted = r.status === 'accepted'
        loginOffset += Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000) // up to 14 days apart
        const lastLogin = isAccepted ? new Date(now - loginOffset) : null

        const [created] = await ctx.db
          .insert(resident)
          .values({
            householdId: hhId,
            email: r.email,
            firstName: r.firstName,
            lastName: r.lastName,
            residentType: r.residentType,
            inviteToken: crypto.randomUUID(),
            inviteStatus: r.status,
            inviteExpiresAt: isAccepted ? null : inviteExpiry,
            lastLoginAt: lastLogin,
          })
          .returning({ id: resident.id })

        if (!created) continue
        residentsCreated++

        // Set primary resident on the household for the first accepted resident per unit
        if (isAccepted && r.primary) {
          await ctx.db
            .update(household)
            .set({ primaryResidentId: created.id })
            .where(eq(household.id, hhId))
        }

        // Assign board role if specified
        if (r.boardRole) {
          await ctx.db.insert(residentRole).values({
            residentId: created.id,
            role: r.boardRole.role,
            rank: r.boardRole.rank,
            title: r.boardRole.title,
            contextId: ctx.communityId,
            contextType: 'community',
            grantedBy: ctx.user.id,
          })
        }
      }

      // Seed a handful of sample announcements authored by the super admin
      const seedAnnouncements = [
        {
          title: 'Welcome to the community portal',
          body: 'We\'re excited to launch our new community portal. Use it to stay informed, connect with neighbors, and access important community documents. Reach out to the board if you have any questions.',
          priority: 'general' as const,
          pinned: true,
        },
        {
          title: 'Pool closure — emergency maintenance',
          body: 'The pool will be closed this weekend for emergency pump repairs. We expect it to reopen Monday morning. We apologize for the inconvenience.',
          priority: 'urgent' as const,
          pinned: false,
        },
        {
          title: 'Annual meeting — save the date',
          body: 'Our annual homeowners meeting will be held on the last Thursday of next month. The agenda will include budget review, board elections, and open floor. All residents are encouraged to attend.',
          priority: 'general' as const,
          pinned: false,
        },
        {
          title: 'Parking reminder',
          body: 'A friendly reminder that all vehicles must display a current parking permit. Vehicles without a valid permit are subject to towing at the owner\'s expense. New permits can be requested via the management office.',
          priority: 'general' as const,
          pinned: false,
        },
      ]

      const existingAnnouncement = await ctx.db.query.announcement.findFirst({
        where: eq(announcement.communityId, ctx.communityId),
      })
      if (!existingAnnouncement) {
        for (const a of seedAnnouncements) {
          await ctx.db.insert(announcement).values({
            communityId: ctx.communityId,
            createdBy: ctx.user.id,
            ...a,
          })
        }
      }

      // Seed sample message threads (skip if any already exist)
      const existingThread = await ctx.db.query.thread.findFirst({
        where: eq(thread.communityId, ctx.communityId),
      })

      if (!existingThread) {
        // Find a couple of seeded residents to be message authors
        const alice = await ctx.db.query.resident.findFirst({ where: eq(resident.email, 'alice.chen@example.com') })
        const bob   = await ctx.db.query.resident.findFirst({ where: eq(resident.email, 'bob.patel@example.com') })
        const diana = await ctx.db.query.resident.findFirst({ where: eq(resident.email, 'diana.f@example.com') })

        const seedThreads: Array<{
          subject: string
          recipientType: 'board' | 'resident' | 'unit'
          createdBy: string
          markRead: boolean
          messages: Array<{ senderId: string; body: string }>
        }> = []

        if (alice) {
          seedThreads.push({
            subject: 'Question about the annual meeting',
            recipientType: 'board',
            createdBy: alice.id,
            markRead: true, // board has read and replied to this one
            messages: [
              { senderId: alice.id, body: "Hi, I wanted to check — will the annual meeting be held in person this year? I'd like to attend but need to arrange childcare in advance." },
              { senderId: ctx.user.id, body: "Hi Alice, yes, it will be in person this year at the community centre. We'll send out the formal notice with the full agenda about two weeks before. Hope you can make it!" },
              { senderId: alice.id, body: 'Great, thanks for confirming! Looking forward to it.' },
            ],
          })
        }

        if (bob) {
          seedThreads.push({
            subject: 'Parking spot confusion',
            recipientType: 'board',
            createdBy: bob.id,
            markRead: true, // board has read and replied to this one
            messages: [
              { senderId: bob.id, body: "There seems to be a mix-up with the visitor parking. Someone has been parking in spot 12 every night this week and I think it's assigned to my unit. Can you look into it?" },
              { senderId: ctx.user.id, body: "Thanks for letting us know, Bob. We'll review the parking assignment list and follow up with the vehicle's owner. We should have this sorted within a day or two." },
            ],
          })
        }

        if (diana) {
          seedThreads.push({
            subject: 'Noise complaint — unit above',
            recipientType: 'board',
            createdBy: diana.id,
            markRead: false, // unread — board hasn't responded yet
            messages: [
              { senderId: diana.id, body: "I've been experiencing loud noise late at night from the unit directly above mine, usually after 11pm. I've tried knocking but there's no answer. Is there a formal process for this?" },
            ],
          })
        }

        for (const t of seedThreads) {
          const [newThread] = await ctx.db
            .insert(thread)
            .values({
              communityId: ctx.communityId,
              subject: t.subject,
              createdBy: t.createdBy,
              recipientType: t.recipientType,
              recipientId: null,
            })
            .returning()

          if (!newThread) continue

          for (const msg of t.messages) {
            await ctx.db.insert(message).values({
              threadId: newThread.id,
              senderId: msg.senderId,
              body: msg.body,
              // Mark as read if the thread is flagged as read (board has seen it)
              readAt: t.markRead ? new Date() : null,
            })
          }

          await ctx.db
            .update(thread)
            .set({ lastMessageAt: new Date() })
            .where(eq(thread.id, newThread.id))
        }
      }

      // Seed meetings
      const existingMeeting = await ctx.db.query.meeting.findFirst({
        where: eq(meeting.communityId, ctx.communityId),
      })

      if (!existingMeeting) {
        const now = new Date()
        const future = (daysAhead: number, hour = 18) => {
          const d = new Date(now)
          d.setDate(d.getDate() + daysAhead)
          d.setHours(hour, 0, 0, 0)
          return d
        }
        const past = (daysAgo: number, hour = 18) => {
          const d = new Date(now)
          d.setDate(d.getDate() - daysAgo)
          d.setHours(hour, 0, 0, 0)
          return d
        }

        const [annualMeeting, boardQ2, boardQ1, specialPool] = await ctx.db.insert(meeting).values([
          {
            communityId: ctx.communityId,
            title: 'Annual Homeowners Meeting',
            meetingType: 'annual',
            location: 'Community Centre — Main Hall',
            scheduledAt: future(28),
            status: 'scheduled',
            createdBy: ctx.user.id,
          },
          {
            communityId: ctx.communityId,
            title: 'Board Meeting — Q2 Budget Review',
            meetingType: 'board',
            location: 'Management Office',
            scheduledAt: future(7, 10),
            status: 'scheduled',
            createdBy: ctx.user.id,
          },
          {
            communityId: ctx.communityId,
            title: 'Board Meeting — Q1 Review',
            meetingType: 'board',
            location: 'Management Office',
            scheduledAt: past(45, 10),
            status: 'held',
            createdBy: ctx.user.id,
          },
          {
            communityId: ctx.communityId,
            title: 'Special Meeting — Pool Renovation',
            meetingType: 'special',
            location: 'Community Centre — Room B',
            scheduledAt: past(90),
            status: 'held',
            createdBy: ctx.user.id,
          },
        ]).returning()

        // Agenda: published for the upcoming annual meeting
        if (annualMeeting) {
          await ctx.db.insert(agenda).values({
            meetingId: annualMeeting.id,
            status: 'published',
            publishedAt: past(2),
            items: [
              { id: crypto.randomUUID(), title: 'Call to order & roll call', duration: 5 },
              { id: crypto.randomUUID(), title: 'Approval of last year\'s minutes', duration: 10 },
              { id: crypto.randomUUID(), title: '2026 budget review & approval', description: 'Treasurer will present the proposed budget for the coming year.', duration: 20 },
              { id: crypto.randomUUID(), title: 'Landscaping contract renewal', description: 'Three bids received. Board recommends Green Grounds LLC.', duration: 15 },
              { id: crypto.randomUUID(), title: 'Open floor — resident questions', duration: 15 },
              { id: crypto.randomUUID(), title: 'Adjournment', duration: 5 },
            ],
          })
        }

        // Agenda: draft for the upcoming board meeting
        if (boardQ2) {
          await ctx.db.insert(agenda).values({
            meetingId: boardQ2.id,
            status: 'draft',
            items: [
              { id: crypto.randomUUID(), title: 'Q1 actuals vs. budget', duration: 15 },
              { id: crypto.randomUUID(), title: 'Reserve fund update', duration: 10 },
              { id: crypto.randomUUID(), title: 'Vendor payment approvals', duration: 10 },
            ],
          })
        }

        // Minutes: published for the Q1 board meeting
        if (boardQ1) {
          const [q1Minutes] = await ctx.db.insert(minutes).values({
            meetingId: boardQ1.id,
            status: 'published',
            body: `Board Meeting — Q1 Review\n${boardQ1.scheduledAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\nManagement Office\n\nATTENDANCE\nPresent: Sarah Chen (President), Michael Torres (Treasurer), Jennifer Walsh (Secretary)\n\nCALL TO ORDER\nMeeting called to order at 10:04 AM by President Chen.\n\nMINUTES APPROVAL\nMinutes from the previous meeting were reviewed and approved unanimously.\n\nQ1 FINANCIAL REPORT\nTreasurer Torres presented the Q1 financial report. Operating account balance: $48,200. Reserve fund: $312,500. Q1 spending came in 3.2% under budget, primarily due to deferred landscaping work pending spring.\n\nACTION ITEMS\n- Torres to follow up with landscaping vendor re: spring schedule by April 15\n- Walsh to post approved minutes to resident portal within 5 business days\n\nADJOURNMENT\nMeeting adjourned at 11:22 AM.`,
            lastEditedBy: ctx.user.id,
            lastEditedAt: past(44),
            finalizedAt: past(44),
            publishedAt: past(43),
          }).returning()

          // Seed approval records
          if (q1Minutes) {
            await ctx.db.insert(minutesApproval).values([
              {
                minutesId: q1Minutes.id,
                residentId: ctx.user.id,
                decision: 'approved',
                round: 1,
                notes: null,
              },
            ])
          }
        }

        // Minutes: in_review for the pool renovation meeting
        if (specialPool) {
          await ctx.db.insert(minutes).values({
            meetingId: specialPool.id,
            status: 'in_review',
            body: `Special Meeting — Pool Renovation\n${specialPool.scheduledAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\nCommunity Centre — Room B\n\nATTENDANCE\nPresent: Sarah Chen, Michael Torres, Jennifer Walsh\nResidents in attendance: 14\n\nPURPOSE\nTo vote on proceeding with pool resurfacing and equipment upgrade.\n\nDISCUSSION\nTorres presented three contractor bids ranging from $42,000 to $67,000. The board discussed scope, timeline, and reserve fund impact.\n\nVOTE\nMotion to award contract to AquaReno Inc. ($52,400) passed 3-0.\n\nTIMELINE\nWork to begin in 60 days. Pool closed for approximately 3 weeks.\n\nACTION ITEMS\n- Chen to execute contract with AquaReno by end of week\n- Walsh to notify residents of pool closure dates once confirmed`,
            lastEditedBy: ctx.user.id,
            lastEditedAt: past(85),
            finalizedAt: past(85),
          })
        }
      }

      // Seed documents (skip if any already exist)
      const existingDocs = await ctx.db.query.document.findFirst({
        where: eq(document.communityId, ctx.communityId),
      })
      if (!existingDocs) {
        const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
        const SAMPLE_PDF = 'https://pdfobject.com/pdf/sample.pdf'
        await ctx.db.insert(document).values([
          {
            communityId: ctx.communityId,
            name: 'Community CC&Rs',
            category: 'governing',
            fileUrl: SAMPLE_PDF,
            fileSizeBytes: 248320,
            version: 2,
            changeNote: 'Updated Section 4.3 — short-term rental restrictions',
            uploadedBy: ctx.user.id,
            createdAt: daysAgo(14),
          },
          {
            communityId: ctx.communityId,
            name: 'Community Bylaws',
            category: 'governing',
            fileUrl: SAMPLE_PDF,
            fileSizeBytes: 184576,
            version: 1,
            uploadedBy: ctx.user.id,
            createdAt: daysAgo(180),
          },
          {
            communityId: ctx.communityId,
            name: 'FY 2026 Approved Budget',
            category: 'budget',
            fileUrl: SAMPLE_PDF,
            fileSizeBytes: 92160,
            version: 1,
            changeNote: 'Approved at Annual Meeting Jan 2026',
            uploadedBy: ctx.user.id,
            createdAt: daysAgo(90),
          },
          {
            communityId: ctx.communityId,
            name: 'Reserve Fund Study 2025',
            category: 'budget',
            fileUrl: SAMPLE_PDF,
            fileSizeBytes: 512000,
            version: 1,
            uploadedBy: ctx.user.id,
            createdAt: daysAgo(200),
          },
          {
            communityId: ctx.communityId,
            name: 'Annual Meeting Minutes — Jan 2026',
            category: 'minutes',
            fileUrl: SAMPLE_PDF,
            fileSizeBytes: 76800,
            version: 1,
            uploadedBy: ctx.user.id,
            createdAt: daysAgo(85),
          },
          {
            communityId: ctx.communityId,
            name: 'Pool & Amenity Use Rules',
            category: 'other',
            fileUrl: SAMPLE_PDF,
            fileSizeBytes: 40960,
            version: 1,
            uploadedBy: ctx.user.id,
            createdAt: daysAgo(365),
          },
        ])
      }

      // Seed polls (skip if any already exist for this community)
      const existingPoll = await ctx.db.query.poll.findFirst({
        where: eq(poll.communityId, ctx.communityId),
      })

      if (!existingPoll) {
        // Find the first accepted resident to use as poll author
        const author = await ctx.db.query.resident.findFirst({
          where: eq(resident.email, 'alice.chen@example.com'),
        }) ?? { id: ctx.user.id }

        const daysAgo  = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
        const daysAhead = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d }

        type PollSeed = {
          title: string
          description: string
          status: 'draft' | 'open' | 'closed'
          eligibility: 'all' | 'owners_only'
          anonymous: boolean
          options: string[]
          closesAt?: Date
          openedAt?: Date
          closedAt?: Date
          skipResponses?: boolean
        }

        const SEED_POLLS: PollSeed[] = [
          {
            title: 'What time should the pool close on weekdays?',
            description: 'We are reviewing pool hours for the season. Please share your preference.',
            status: 'open',
            eligibility: 'all',
            anonymous: false,
            options: ['8:00 PM', '9:00 PM', '10:00 PM', 'No change needed'],
            openedAt: daysAgo(3),
          },
          {
            title: 'Should we install EV charging stations in the parking garage?',
            description: 'The board is exploring adding 4 Level-2 EV chargers. Installation cost would be covered by a special assessment. This poll is anonymous.',
            status: 'open',
            eligibility: 'owners_only',
            anonymous: true,
            options: ['Yes — proceed with installation', 'No — I do not support this', 'Yes, but explore grants or incentives first'],
            closesAt: daysAhead(7),
            openedAt: daysAgo(1),
          },
          {
            title: 'Should we update the community landscaping design?',
            description: 'The board is considering a new landscaping proposal for the common areas. We want your input before moving forward.',
            status: 'draft',
            eligibility: 'all',
            anonymous: false,
            options: ['Yes, I support the proposal', 'No, keep the current design', 'I need more information before deciding'],
          },
          {
            title: 'How satisfied are you with the current trash collection schedule?',
            description: 'The board is reviewing our waste management contract. Your feedback will help us decide whether to request a schedule change.',
            status: 'open',
            eligibility: 'all',
            anonymous: false,
            options: ['Very satisfied', 'Somewhat satisfied', 'Neutral', 'Somewhat dissatisfied', 'Very dissatisfied'],
            openedAt: daysAgo(1),
            closesAt: daysAhead(10),
            skipResponses: true,
          },
          {
            title: 'Should we install security cameras in the parking lot?',
            description: 'Following recent incidents, the board proposed installing 6 security cameras. Footage would be retained for 30 days.',
            status: 'closed',
            eligibility: 'all',
            anonymous: false,
            options: ['Yes — install cameras', 'No — I have privacy concerns', 'Yes, but only at entry/exit points'],
            openedAt: daysAgo(14),
            closedAt: daysAgo(2),
            closesAt: daysAgo(2),
          },
        ]

        // Gather accepted residents for responses
        const acceptedResidents = await ctx.db.query.resident.findMany({
          where: eq(resident.inviteStatus, 'accepted'),
          columns: { id: true },
        })

        for (const p of SEED_POLLS) {
          const [created] = await ctx.db
            .insert(poll)
            .values({
              communityId: ctx.communityId,
              createdBy: author.id,
              title: p.title,
              description: p.description,
              status: p.status,
              eligibility: p.eligibility,
              anonymous: p.anonymous,
              closesAt: p.closesAt ?? null,
              openedAt: p.openedAt ?? null,
              closedAt: p.closedAt ?? null,
            })
            .returning({ id: poll.id })

          if (!created) continue
          pollsCreated++

          await ctx.db.insert(pollOption).values(
            p.options.map((label, i) => ({ pollId: created.id, label, displayOrder: i }))
          )

          // Add responses to open and closed polls (unless explicitly skipped)
          if ((p.status === 'open' || p.status === 'closed') && !p.skipResponses && acceptedResidents.length > 1) {
            const options = await ctx.db.query.pollOption.findMany({
              where: eq(pollOption.pollId, created.id),
            })
            const voters = acceptedResidents.filter(r => r.id !== author.id)
            const dist = [0, 1, 2, 0, 1, 0, 2, 1, 0, 1]
            const maxVoters = p.status === 'closed' ? voters.length : Math.min(4, voters.length)
            for (let i = 0; i < maxVoters; i++) {
              const voter = voters[i]!
              const option = options[dist[i % dist.length]! % options.length]!
              await ctx.db.insert(pollResponse).values({
                pollId: created.id,
                residentId: voter.id,
                optionId: option.id,
              }).onConflictDoNothing()
            }
          }
        }
      }

      // ── Maintenance requests ────────────────────────────────────────────
      type MaintenanceSeed = {
        unitIndex: number; title: string; description?: string
        priority: 'urgent' | 'routine'; status: 'open' | 'in_progress' | 'resolved'; boardNotes?: string
      }
      const MAINTENANCE_SEEDS: MaintenanceSeed[] = [
        { unitIndex: 0, title: 'Leaky faucet in kitchen', description: 'The cold water tap has been dripping for two weeks. Getting worse.', priority: 'routine', status: 'in_progress', boardNotes: 'Plumber scheduled for Friday 10am.' },
        { unitIndex: 1, title: 'Heating not working in bedroom', description: 'Radiator in main bedroom is cold even when thermostat is turned up. Other rooms are fine.', priority: 'urgent', status: 'open' },
        { unitIndex: 2, title: 'Broken window latch', description: 'The latch on the living room window is broken — window won\'t stay closed.', priority: 'routine', status: 'resolved', boardNotes: 'Repaired and tested. Let us know if there are further issues.' },
        { unitIndex: 4, title: 'Hallway light out', description: 'The light outside unit 10 has been out for a week. Hard to see at night.', priority: 'routine', status: 'open' },
        { unitIndex: 6, title: 'Mould in bathroom', description: 'Black mould appearing around the shower grout and ceiling corner.', priority: 'urgent', status: 'in_progress', boardNotes: 'Remediation team inspecting next Monday.' },
        { unitIndex: 7, title: 'Garage door not closing fully', description: 'The garage door stops about 6 inches from the ground and reverses. Started last week.', priority: 'routine', status: 'open' },
      ]

      const seededUnitRows = await ctx.db.query.unit.findMany({
        where: eq(unit.communityId, ctx.communityId),
        with: { households: { with: { residents: { columns: { id: true } } } } },
      })

      for (const m of MAINTENANCE_SEEDS) {
        const targetUnit = seededUnitRows[m.unitIndex]
        const submitter = targetUnit?.households?.[0]?.residents?.[0]
        if (!targetUnit || !submitter) continue

        await ctx.db.insert(unitMaintenanceRequest).values({
          communityId: ctx.communityId,
          unitId: targetUnit.id,
          submittedBy: submitter.id,
          title: m.title,
          description: m.description,
          priority: m.priority,
          status: m.status,
          boardNotes: m.boardNotes,
          resolvedAt: m.status === 'resolved' ? new Date() : null,
        })
        maintenanceCreated++
      }

      return { unitsCreated, residentsCreated, skipped, pollsCreated, maintenanceCreated }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
    }
  }),

  reset: superAdminProcedure
    .input(z.object({ confirm: z.literal('RESET') }))
    .mutation(async ({ ctx }): Promise<{ deleted: Record<string, number> }> => {
      try {
        const myResidentId = ctx.user.id
        const myHouseholdId = ctx.user.householdId
        const myUnitId = ctx.user.household?.unit?.id

        const counts: Record<string, number> = {}

        // Meetings + agenda + minutes
        const meetingIds = await ctx.db.query.meeting.findMany({
          where: eq(meeting.communityId, ctx.communityId),
          columns: { id: true },
        })
        for (const m of meetingIds) {
          const agendaRows = await ctx.db.query.agenda.findMany({ where: eq(agenda.meetingId, m.id), columns: { id: true } })
          for (const a of agendaRows) {
            await ctx.db.delete(minutesApproval).where(eq(minutesApproval.minutesId, a.id))
          }
          await ctx.db.delete(agenda).where(eq(agenda.meetingId, m.id))
          const minutesRows = await ctx.db.query.minutes.findMany({ where: eq(minutes.meetingId, m.id), columns: { id: true } })
          for (const mn of minutesRows) {
            await ctx.db.delete(minutesApproval).where(eq(minutesApproval.minutesId, mn.id))
          }
          await ctx.db.delete(minutes).where(eq(minutes.meetingId, m.id))
        }
        const deletedMeetings = await ctx.db
          .delete(meeting)
          .where(eq(meeting.communityId, ctx.communityId))
          .returning({ id: meeting.id })
        counts.meetings = deletedMeetings.length

        // Messages + threads
        const deletedMessages = await ctx.db
          .delete(message)
          .returning({ id: message.id })
        counts.messages = deletedMessages.length

        const deletedThreads = await ctx.db
          .delete(thread)
          .where(eq(thread.communityId, ctx.communityId))
          .returning({ id: thread.id })
        counts.threads = deletedThreads.length

        // Notifications
        const deletedNotifs = await ctx.db
          .delete(notification)
          .where(ne(notification.residentId, myResidentId))
          .returning({ id: notification.id })
        counts.notifications = deletedNotifs.length

        // Documents
        const deletedDocs = await ctx.db
          .delete(document)
          .where(eq(document.communityId, ctx.communityId))
          .returning({ id: document.id })
        counts.documents = deletedDocs.length

        // Announcements
        const deletedAnnouncements = await ctx.db
          .delete(announcement)
          .where(eq(announcement.communityId, ctx.communityId))
          .returning({ id: announcement.id })
        counts.announcements = deletedAnnouncements.length

        // Resident roles (non-current user)
        const deletedRoles = await ctx.db
          .delete(residentRole)
          .where(ne(residentRole.residentId, myResidentId))
          .returning({ id: residentRole.id })
        counts.residentRoles = deletedRoles.length

        // Polls + responses (cascade deletes options, but responses need explicit delete first)
        const pollIds = await ctx.db.query.poll.findMany({
          where: eq(poll.communityId, ctx.communityId),
          columns: { id: true },
        })
        if (pollIds.length) {
          for (const p of pollIds) {
            await ctx.db.delete(pollResponse).where(eq(pollResponse.pollId, p.id))
          }
          const deletedPolls = await ctx.db
            .delete(poll)
            .where(eq(poll.communityId, ctx.communityId))
            .returning({ id: poll.id })
          counts.polls = deletedPolls.length
        }

        // Maintenance requests (cascade on unit/resident delete, but delete explicitly for clarity)
        const deletedMaintenance = await ctx.db
          .delete(unitMaintenanceRequest)
          .where(eq(unitMaintenanceRequest.communityId, ctx.communityId))
          .returning({ id: unitMaintenanceRequest.id })
        counts.maintenanceRequests = deletedMaintenance.length

        // Passkey credentials (non-current user) — must go before residents
        await ctx.db
          .delete(passkeyCredential)
          .where(ne(passkeyCredential.residentId, myResidentId))

        // Nullify primaryResidentId on all households except current user's
        // to avoid FK violation when deleting residents below
        await ctx.db
          .update(household)
          .set({ primaryResidentId: null })
          .where(ne(household.id, myHouseholdId))

        // Residents (non-current user)
        const deletedResidents = await ctx.db
          .delete(resident)
          .where(ne(resident.id, myResidentId))
          .returning({ id: resident.id })
        counts.residents = deletedResidents.length

        // Households (not current user's)
        const deletedHouseholds = await ctx.db
          .delete(household)
          .where(ne(household.id, myHouseholdId))
          .returning({ id: household.id })
        counts.households = deletedHouseholds.length

        // Units (not current user's)
        if (myUnitId) {
          const deletedUnits = await ctx.db
            .delete(unit)
            .where(and(eq(unit.communityId, ctx.communityId), ne(unit.id, myUnitId)))
            .returning({ id: unit.id })
          counts.units = deletedUnits.length
        }

        return { deleted: counts }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),
})
