import type { resident, residentRole, household, unit } from '../server/db/schema'

export type Resident = typeof resident.$inferSelect
export type ResidentRole = typeof residentRole.$inferSelect
export type Household = typeof household.$inferSelect
export type Unit = typeof unit.$inferSelect

export type ResidentWithRoles = Resident & {
  roles: ResidentRole[]
}

export type AuthUser = Resident & {
  roles: ResidentRole[]
  household: Household & {
    unit: Unit
  }
}

export type Role = 'super_admin' | 'board_member' | 'committee_lead'

export type NotificationCategory =
  | 'urgent_announcement'
  | 'violation'
  | 'vote_result'
  | 'board_dm'
  | 'general_announcement'
  | 'vote_reminder'
  | 'agenda_published'
  | 'minutes_published'
  | 'maintenance_update'
  | 'forum_activity'
  | 'dm'
