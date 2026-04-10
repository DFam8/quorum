// server/db/schema.ts
import {
    pgTable, uuid, varchar, text, boolean,
    integer, decimal, timestamp, date,
    pgEnum, jsonb, unique
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────

export const unitTypeEnum = pgEnum('unit_type', ['condo', 'apartment', 'sfh'])
export const residentTypeEnum = pgEnum('resident_type', ['owner', 'renter'])
export const householdStatusEnum = pgEnum('household_status', ['active', 'moved_out'])
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'expired'])
export const roleEnum = pgEnum('role', ['super_admin', 'board_member', 'committee_lead'])
export const contextTypeEnum = pgEnum('context_type', ['community', 'committee'])
export const meetingStatusEnum = pgEnum('meeting_status', ['scheduled', 'held', 'cancelled'])
export const agendaStatusEnum = pgEnum('agenda_status', ['draft', 'published'])
export const minutesStatusEnum = pgEnum('minutes_status', ['drafting', 'in_review', 'approved', 'published'])
export const minutesDecisionEnum = pgEnum('minutes_decision', ['approved', 'changes_requested'])
export const pollStatusEnum = pgEnum('poll_status', ['draft', 'open', 'closed'])
export const pollEligibilityEnum = pgEnum('poll_eligibility', ['all', 'owners_only'])
export const voteTypeEnum = pgEnum('vote_type', ['election', 'budget', 'bylaw', 'improvement'])
export const voteStatusEnum = pgEnum('vote_status', ['pending_approval', 'open', 'closed', 'failed', 'accepted', 'published'])
export const quorumFailureModeEnum = pgEnum('quorum_failure_mode', ['rerun', 'auto_extend', 'super_admin_override'])
export const ballotChoiceEnum = pgEnum('ballot_choice', ['yes', 'no', 'abstain'])
export const boardAcceptanceEnum = pgEnum('board_acceptance_decision', ['accepted', 'not_accepted'])
export const facilityStatusEnum = pgEnum('facility_status', ['open', 'closed', 'under_maintenance'])
export const bookingStatusEnum = pgEnum('booking_status', ['confirmed', 'cancelled', 'overridden'])
export const maintenancePriorityEnum = pgEnum('maintenance_priority', ['urgent', 'routine'])
export const maintenanceStatusEnum = pgEnum('maintenance_status', ['open', 'in_progress', 'resolved'])
export const committeeModeEnum = pgEnum('committee_mode', ['auto_approve', 'manual', 'invite_only'])
export const committeeStatusEnum = pgEnum('committee_status', ['active', 'archived'])
export const committeeMemberStatusEnum = pgEnum('committee_member_status', ['pending', 'member', 'removed'])
export const notificationCategoryEnum = pgEnum('notification_category', [
    'urgent_announcement', 'violation', 'vote_result', 'board_dm',
    'general_announcement', 'vote_reminder', 'agenda_published',
    'minutes_published', 'maintenance_update', 'forum_activity', 'dm'
])
export const notificationChannelEnum = pgEnum('notification_channel', ['email', 'in_app', 'sms'])
export const notificationStatusEnum = pgEnum('notification_status', ['queued', 'sent', 'delivered', 'failed'])
export const aiModeEnum = pgEnum('ai_mode', ['polish', 'rewrite', 'suggest'])
export const aiToneEnum = pgEnum('ai_tone', ['formal', 'friendly', 'neutral'])
export const aiInputTypeEnum = pgEnum('ai_input_type', ['draft', 'prompt'])

// ─── Core ────────────────────────────────────────────────────────────────

export const community = pgTable('community', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    address: varchar('address', { length: 500 }),
    timezone: varchar('timezone', { length: 100 }).notNull().default('America/Chicago'),
    maxSuperAdmins: integer('max_super_admins').notNull().default(2),
    maxOccupantsPerUnit: integer('max_occupants_per_unit').notNull().default(8),
    settings: jsonb('settings').default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const unit = pgTable('unit', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    unitNumber: varchar('unit_number', { length: 50 }).notNull().unique(),
    unitType: unitTypeEnum('unit_type').notNull(),
    building: varchar('building', { length: 100 }),
    floor: integer('floor'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const household = pgTable('household', {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id').notNull().references(() => unit.id),
    primaryResidentId: uuid('primary_resident_id'),
    status: householdStatusEnum('status').notNull().default('active'),
    moveInDate: date('move_in_date'),
    moveOutDate: date('move_out_date'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type NotificationSettings = {
    emailAnnouncements?: boolean
    emailMeetings?: boolean
    emailMessages?: boolean
    bottomNav?: string[]
}

export const resident = pgTable('resident', {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull().references(() => household.id),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 50 }),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    residentType: residentTypeEnum('resident_type').notNull(),
    directoryOptOut: boolean('directory_opt_out').notNull().default(false),
    allowDirectMessages: boolean('allow_direct_messages').notNull().default(true),
    notificationSettings: jsonb('notification_settings').$type<NotificationSettings>().default({}),
    inviteStatus: inviteStatusEnum('invite_status').notNull().default('pending'),
    inviteToken: varchar('invite_token', { length: 255 }),
    inviteExpiresAt: timestamp('invite_expires_at'),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const residentRole = pgTable('resident_role', {
    id: uuid('id').primaryKey().defaultRandom(),
    residentId: uuid('resident_id').notNull().references(() => resident.id),
    role: roleEnum('role').notNull(),
    rank: integer('rank'),               // 1 - 4, board_member only
    title: varchar('title', { length: 100 }),
    contextId: uuid('context_id').notNull(), // community_id or committee_id
    contextType: contextTypeEnum('context_type').notNull(),
    temporary: boolean('temporary').notNull().default(false),
    temporaryReason: varchar('temporary_reason', { length: 255 }),
    grantedBy: uuid('granted_by').references(() => resident.id),
    grantedAt: timestamp('granted_at').notNull().defaultNow(),
    revokedAt: timestamp('revoked_at'),
})

// ─── Meetings ─────────────────────────────────────────────────────────────

export const meeting = pgTable('meeting', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    title: varchar('title', { length: 255 }).notNull(),
    meetingType: varchar('meeting_type', { length: 100 }),
    location: varchar('location', { length: 255 }),
    scheduledAt: timestamp('scheduled_at').notNull(),
    status: meetingStatusEnum('status').notNull().default('scheduled'),
    createdBy: uuid('created_by').notNull().references(() => resident.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const agenda = pgTable('agenda', {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id').notNull().references(() => meeting.id),
    status: agendaStatusEnum('status').notNull().default('draft'),
    commentsEnabled: boolean('comments_enabled').notNull().default(false),
    publishedAt: timestamp('published_at'),
    items: jsonb('items').notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const agendaComment = pgTable('agenda_comment', {
    id: uuid('id').primaryKey().defaultRandom(),
    agendaId: uuid('agenda_id').notNull().references(() => agenda.id),
    residentId: uuid('resident_id').notNull().references(() => resident.id),
    body: text('body').notNull(),
    hidden: boolean('hidden').notNull().default(false),
    hiddenReason: text('hidden_reason'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const minutes = pgTable('minutes', {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id').notNull().references(() => meeting.id),
    status: minutesStatusEnum('status').notNull().default('drafting'),
    body: text('body'),
    importedDocUrl: varchar('imported_doc_url', { length: 500 }),
    lastEditedBy: uuid('last_edited_by').references(() => resident.id),
    lastEditedAt: timestamp('last_edited_at'),
    finalizedAt: timestamp('finalized_at'),
    publishedAt: timestamp('published_at'),
    reminderSentAt: timestamp('reminder_sent_at'),
    escalationSentAt: timestamp('escalation_sent_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const minutesApproval = pgTable('minutes_approval', {
    id: uuid('id').primaryKey().defaultRandom(),
    minutesId: uuid('minutes_id').notNull().references(() => minutes.id),
    residentId: uuid('resident_id').notNull().references(() => resident.id),
    decision: minutesDecisionEnum('decision').notNull(),
    round: integer('round').notNull().default(1),
    notes: text('notes'),
    votedAt: timestamp('voted_at').notNull().defaultNow(),
})

// ─── Voting ───────────────────────────────────────────────────────────────

export const vote = pgTable('vote', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    parentVoteId: uuid('parent_vote_id').references((): any => vote.id),
    runNumber: integer('run_number').notNull().default(1),
    voteType: voteTypeEnum('vote_type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    thresholdPct: decimal('threshold_pct', { precision: 5, scale: 2 }).notNull(),
    quorumPct: decimal('quorum_pct', { precision: 5, scale: 2 }).notNull(),
    quorumFailureMode: quorumFailureModeEnum('quorum_failure_mode').notNull().default('rerun'),
    maxReruns: integer('max_reruns').notNull().default(3),
    status: voteStatusEnum('status').notNull().default('pending_approval'),
    opensAt: timestamp('opens_at'),
    closesAt: timestamp('closes_at'),
    createdBy: uuid('created_by').notNull().references(() => resident.id),
    approvedBy: uuid('approved_by').references(() => resident.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const ballot = pgTable('ballot', {
    id: uuid('id').primaryKey().defaultRandom(),
    voteId: uuid('vote_id').notNull().references(() => vote.id),
    householdId: uuid('household_id').notNull().references(() => household.id),
    castBy: uuid('cast_by').notNull().references(() => resident.id),
    choice: ballotChoiceEnum('choice').notNull(),
    castAt: timestamp('cast_at').notNull().defaultNow(),
}, (t) => ({
    uniqueHouseholdVote: unique().on(t.voteId, t.householdId),
}))

export const boardAcceptance = pgTable('board_acceptance', {
    id: uuid('id').primaryKey().defaultRandom(),
    voteId: uuid('vote_id').notNull().references(() => vote.id),
    residentId: uuid('resident_id').notNull().references(() => resident.id),
    decision: boardAcceptanceEnum('decision').notNull(),
    notes: text('notes'),
    votedAt: timestamp('voted_at').notNull().defaultNow(),
})

// ─── Polls ───────────────────────────────────────────────────────────────────

export const poll = pgTable('poll', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: pollStatusEnum('status').notNull().default('draft'),
    eligibility: pollEligibilityEnum('eligibility').notNull().default('all'),
    anonymous: boolean('anonymous').notNull().default(false),
    closesAt: timestamp('closes_at'),
    openedAt: timestamp('opened_at'),
    closedAt: timestamp('closed_at'),
    createdBy: uuid('created_by').notNull().references(() => resident.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const pollOption = pgTable('poll_option', {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id').notNull().references(() => poll.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull(),
    displayOrder: integer('display_order').notNull().default(0),
})

export const meetingRsvpStatusEnum = pgEnum('meeting_rsvp_status', ['attending', 'not_attending'])

export const meetingRsvp = pgTable('meeting_rsvp', {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id').notNull().references(() => meeting.id, { onDelete: 'cascade' }),
    residentId: uuid('resident_id').notNull().references(() => resident.id, { onDelete: 'cascade' }),
    status: meetingRsvpStatusEnum('status').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
    uniqueResidentMeeting: unique().on(t.meetingId, t.residentId),
}))

export const meetingRsvpRelations = relations(meetingRsvp, ({ one }) => ({
    meeting: one(meeting, { fields: [meetingRsvp.meetingId], references: [meeting.id] }),
    resident: one(resident, { fields: [meetingRsvp.residentId], references: [resident.id] }),
}))

export const pollResponse = pgTable('poll_response', {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id').notNull().references(() => poll.id),
    residentId: uuid('resident_id').notNull().references(() => resident.id),
    optionId: uuid('option_id').notNull().references(() => pollOption.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
    uniqueResidentPoll: unique().on(t.pollId, t.residentId),
}))

// ─── Assets ───────────────────────────────────────────────────────────────

export const facility = pgTable('facility', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    capacity: integer('capacity'),
    status: facilityStatusEnum('status').notNull().default('open'),
    bookingRestrictions: jsonb('booking_restrictions').default({}),
    hours: jsonb('hours').default({}),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const booking = pgTable('booking', {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id').notNull().references(() => facility.id),
    householdId: uuid('household_id').notNull().references(() => household.id),
    bookedBy: uuid('booked_by').notNull().references(() => resident.id),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    guestCount: integer('guest_count'),
    notes: text('notes'),
    status: bookingStatusEnum('status').notNull().default('confirmed'),
    cancelledBy: uuid('cancelled_by').references(() => resident.id),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const maintenanceRequest = pgTable('maintenance_request', {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id').notNull().references(() => facility.id),
    submittedBy: uuid('submitted_by').notNull().references(() => resident.id),
    assignedTo: uuid('assigned_to').references(() => resident.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    photoUrls: jsonb('photo_urls').default([]),
    priority: maintenancePriorityEnum('priority').notNull().default('routine'),
    status: maintenanceStatusEnum('status').notNull().default('open'),
    resolutionNotes: text('resolution_notes'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Sub-committees ───────────────────────────────────────────────────────

export const subCommittee = pgTable('sub_committee', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    name: varchar('name', { length: 255 }).notNull(),
    purpose: text('purpose'),
    leadResidentId: uuid('lead_resident_id').references(() => resident.id),
    membershipMode: committeeModeEnum('membership_mode').notNull().default('manual'),
    status: committeeStatusEnum('status').notNull().default('active'),
    archivedAt: timestamp('archived_at'),
    createdBy: uuid('created_by').notNull().references(() => resident.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const committeeMember = pgTable('committee_member', {
    id: uuid('id').primaryKey().defaultRandom(),
    committeeId: uuid('committee_id').notNull().references(() => subCommittee.id),
    residentId: uuid('resident_id').notNull().references(() => resident.id),
    status: committeeMemberStatusEnum('status').notNull().default('pending'),
    invitedBy: uuid('invited_by').references(() => resident.id),
    joinedAt: timestamp('joined_at'),
    removedAt: timestamp('removed_at'),
    removalReason: text('removal_reason'),
})

// ─── Platform infrastructure ──────────────────────────────────────────────

export const segment = pgTable('segment', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    name: varchar('name', { length: 255 }).notNull(),
    createdBy: uuid('created_by').notNull().references(() => resident.id),
    filterCriteria: jsonb('filter_criteria').notNull().default({}),
    lastEvaluatedAt: timestamp('last_evaluated_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const notification = pgTable('notification', {
    id: uuid('id').primaryKey().defaultRandom(),
    residentId: uuid('resident_id').notNull().references(() => resident.id),
    category: notificationCategoryEnum('category').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    subject: varchar('subject', { length: 500 }),
    body: text('body'),
    mandatory: boolean('mandatory').notNull().default(false),
    status: notificationStatusEnum('status').notNull().default('queued'),
    sentAt: timestamp('sent_at'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const auditLog = pgTable('audit_log', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    actorId: uuid('actor_id').references(() => resident.id),
    action: varchar('action', { length: 255 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ipAddress: varchar('ip_address', { length: 50 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Documents ────────────────────────────────────────────────────────────

export const document = pgTable('document', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    fileUrl: varchar('file_url', { length: 500 }).notNull(),
    fileSizeBytes: integer('file_size_bytes'),
    version: integer('version').notNull().default(1),
    changeNote: text('change_note'),
    parentId: uuid('parent_id'),
    uploadedBy: uuid('uploaded_by').notNull().references(() => resident.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Announcements & Messages ─────────────────────────────────────────────

export const announcement = pgTable('announcement', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    priority: varchar('priority', { length: 20 }).notNull().default('general'),
    pinned: boolean('pinned').notNull().default(false),
    hidden: boolean('hidden').notNull().default(false),
    hiddenReason: text('hidden_reason'),
    editHistory: jsonb('edit_history').$type<Array<{ editedAt: string; editedBy: string; title: string; body: string }>>().default([]),
    createdBy: uuid('created_by').notNull().references(() => resident.id),
    imageUrl: text('image_url'),
    aiAssisted: boolean('ai_assisted').default(false),
    aiMode: aiModeEnum('ai_mode'),
    aiTone: aiToneEnum('ai_tone'),
    aiInput: text('ai_input'),
    aiInputType: aiInputTypeEnum('ai_input_type'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const thread = pgTable('thread', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    subject: varchar('subject', { length: 255 }).notNull(),
    createdBy: uuid('created_by').notNull().references(() => resident.id),
    recipientType: varchar('recipient_type', { length: 20 }).notNull(), // 'board' | 'resident' | 'unit'
    recipientId: uuid('recipient_id'), // null=board, residentId or unitId otherwise
    lastMessageAt: timestamp('last_message_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const message = pgTable('message', {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id').notNull().references(() => thread.id),
    senderId: uuid('sender_id').notNull().references(() => resident.id),
    body: text('body').notNull(),
    hidden: boolean('hidden').notNull().default(false),
    hiddenReason: text('hidden_reason'),
    readAt: timestamp('read_at'),
    aiAssisted: boolean('ai_assisted').default(false),
    aiMode: aiModeEnum('ai_mode'),
    aiTone: aiToneEnum('ai_tone'),
    aiInput: text('ai_input'),
    aiInputType: aiInputTypeEnum('ai_input_type'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────

export const communityRelations = relations(community, ({ many }) => ({
    units: many(unit),
}))

export const unitRelations = relations(unit, ({ one, many }) => ({
    community: one(community, { fields: [unit.communityId], references: [community.id] }),
    households: many(household),
}))

export const householdRelations = relations(household, ({ one, many }) => ({
    unit: one(unit, { fields: [household.unitId], references: [unit.id] }),
    primaryResident: one(resident, { fields: [household.primaryResidentId], references: [resident.id], relationName: 'primaryResident' }),
    residents: many(resident, { relationName: 'householdResidents' }),
}))

export const residentRelations = relations(resident, ({ one, many }) => ({
    household: one(household, { fields: [resident.householdId], references: [household.id], relationName: 'householdResidents' }),
    roles: many(residentRole),
    notifications: many(notification),
}))

export const residentRoleRelations = relations(residentRole, ({ one }) => ({
    resident: one(resident, { fields: [residentRole.residentId], references: [resident.id] }),
}))

export const notificationRelations = relations(notification, ({ one }) => ({
    resident: one(resident, { fields: [notification.residentId], references: [resident.id] }),
}))

export const meetingRelations = relations(meeting, ({ one, many }) => ({
    community: one(community, { fields: [meeting.communityId], references: [community.id] }),
    createdByResident: one(resident, { fields: [meeting.createdBy], references: [resident.id] }),
    agenda: one(agenda, { fields: [meeting.id], references: [agenda.meetingId] }),
    minutes: one(minutes, { fields: [meeting.id], references: [minutes.meetingId] }),
    rsvps: many(meetingRsvp),
}))

export const agendaRelations = relations(agenda, ({ one, many }) => ({
    meeting: one(meeting, { fields: [agenda.meetingId], references: [meeting.id] }),
    comments: many(agendaComment),
}))

export const minutesRelations = relations(minutes, ({ one, many }) => ({
    meeting: one(meeting, { fields: [minutes.meetingId], references: [meeting.id] }),
    approvals: many(minutesApproval),
}))

export const minutesApprovalRelations = relations(minutesApproval, ({ one }) => ({
    minutes: one(minutes, { fields: [minutesApproval.minutesId], references: [minutes.id] }),
    resident: one(resident, { fields: [minutesApproval.residentId], references: [resident.id] }),
}))

export const announcementRelations = relations(announcement, ({ one, many }) => ({
    community: one(community, { fields: [announcement.communityId], references: [community.id] }),
    createdByResident: one(resident, { fields: [announcement.createdBy], references: [resident.id] }),
    reads: many(announcementRead),
}))

export const announcementRead = pgTable('announcement_read', {
    id: uuid('id').primaryKey().defaultRandom(),
    announcementId: uuid('announcement_id').notNull().references(() => announcement.id, { onDelete: 'cascade' }),
    residentId: uuid('resident_id').notNull().references(() => resident.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at').notNull().defaultNow(),
}, (t) => ({
    uniqueResidentAnnouncement: unique().on(t.announcementId, t.residentId),
}))

export const announcementReadRelations = relations(announcementRead, ({ one }) => ({
    announcement: one(announcement, { fields: [announcementRead.announcementId], references: [announcement.id] }),
    resident: one(resident, { fields: [announcementRead.residentId], references: [resident.id] }),
}))

export const documentRelations = relations(document, ({ one }) => ({
    community: one(community, { fields: [document.communityId], references: [community.id] }),
    uploadedByResident: one(resident, { fields: [document.uploadedBy], references: [resident.id] }),
}))

export const threadRelations = relations(thread, ({ one, many }) => ({
    community: one(community, { fields: [thread.communityId], references: [community.id] }),
    createdByResident: one(resident, { fields: [thread.createdBy], references: [resident.id] }),
    messages: many(message),
}))

export const messageRelations = relations(message, ({ one }) => ({
    thread: one(thread, { fields: [message.threadId], references: [thread.id] }),
    sender: one(resident, { fields: [message.senderId], references: [resident.id] }),
}))

export const pollRelations = relations(poll, ({ one, many }) => ({
    community: one(community, { fields: [poll.communityId], references: [community.id] }),
    createdByResident: one(resident, { fields: [poll.createdBy], references: [resident.id] }),
    options: many(pollOption),
    responses: many(pollResponse),
}))

export const pollOptionRelations = relations(pollOption, ({ one, many }) => ({
    poll: one(poll, { fields: [pollOption.pollId], references: [poll.id] }),
    responses: many(pollResponse),
}))

export const pollResponseRelations = relations(pollResponse, ({ one }) => ({
    poll: one(poll, { fields: [pollResponse.pollId], references: [poll.id] }),
    resident: one(resident, { fields: [pollResponse.residentId], references: [resident.id] }),
    option: one(pollOption, { fields: [pollResponse.optionId], references: [pollOption.id] }),
}))

// ─── Passkey Credentials ─────────────────────────────────────────────────

export const passkeyCredential = pgTable('passkey_credential', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id, { onDelete: 'cascade' }),
    residentId: uuid('resident_id').notNull().references(() => resident.id, { onDelete: 'cascade' }),
    // WebAuthn credential ID (base64url-encoded)
    credentialId: varchar('credential_id', { length: 1024 }).notNull().unique(),
    // COSE public key (base64url-encoded Uint8Array)
    publicKey: text('public_key').notNull(),
    // Signature counter — used to detect cloned authenticators
    counter: integer('counter').notNull().default(0),
    // 'singleDevice' | 'multiDevice'
    deviceType: varchar('device_type', { length: 32 }).notNull(),
    // Whether the credential is backed up (synced across devices, e.g. iCloud Keychain)
    backedUp: boolean('backed_up').notNull().default(false),
    // AuthenticatorTransport values (e.g. ['internal', 'hybrid'])
    transports: jsonb('transports').$type<string[]>().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at'),
})

export const passkeyCredentialRelations = relations(passkeyCredential, ({ one }) => ({
    community: one(community, { fields: [passkeyCredential.communityId], references: [community.id] }),
    resident: one(resident, { fields: [passkeyCredential.residentId], references: [resident.id] }),
}))

// ─── Unit maintenance requests ────────────────────────────────────────────

export const unitMaintenanceRequest = pgTable('unit_maintenance_request', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').notNull().references(() => community.id),
    unitId: uuid('unit_id').notNull().references(() => unit.id),
    submittedBy: uuid('submitted_by').notNull().references(() => resident.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    priority: maintenancePriorityEnum('priority').notNull().default('routine'),
    status: maintenanceStatusEnum('status').notNull().default('open'),
    boardNotes: text('board_notes'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const unitMaintenanceRequestRelations = relations(unitMaintenanceRequest, ({ one }) => ({
    community: one(community, { fields: [unitMaintenanceRequest.communityId], references: [community.id] }),
    unit: one(unit, { fields: [unitMaintenanceRequest.unitId], references: [unit.id] }),
    submittedByResident: one(resident, { fields: [unitMaintenanceRequest.submittedBy], references: [resident.id] }),
}))