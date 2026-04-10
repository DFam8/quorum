import { serverSupabaseUser } from '#supabase/server'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { meeting, resident, community } from '../../db/schema'

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export default defineEventHandler(async (event) => {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser?.email) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const res = await db.query.resident.findFirst({ where: eq(resident.email, supabaseUser.email) })
  if (!res) throw createError({ statusCode: 403, message: 'Not found' })

  const id = getRouterParam(event, 'id')
  const m = await db.query.meeting.findFirst({
    where: and(eq(meeting.id, id!), eq(meeting.communityId, res.communityId)),
    with: { community: true },
  })
  if (!m) throw createError({ statusCode: 404, message: 'Meeting not found' })

  const start = new Date(m.scheduledAt)
  // Default to 1 hour duration
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  const comm = m.community as { name: string } | null
  const communityName = comm?.name ?? 'Community'

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quorum//HOA Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:meeting-${m.id}@quorum.community`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(`${m.title} – ${communityName}`)}`,
    m.location ? `LOCATION:${icsEscape(m.location)}` : null,
    `DESCRIPTION:${icsEscape(`${m.meetingType ? m.meetingType.charAt(0).toUpperCase() + m.meetingType.slice(1) + ' meeting' : 'Meeting'} for ${communityName}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  setHeader(event, 'Content-Type', 'text/calendar; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="meeting-${m.id}.ics"`)
  return lines
})
