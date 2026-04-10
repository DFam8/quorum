import type { AuthUser, ResidentWithRoles, ResidentRole } from '../types'

type UserWithRoles = { roles: ResidentRole[] }

function hasActiveRole(user: UserWithRoles, role: ResidentRole['role']): boolean {
  return user.roles.some(r => r.role === role && !r.revokedAt)
}

export function isSuperAdmin(user: UserWithRoles): boolean {
  return hasActiveRole(user, 'super_admin')
}

export function isBoardMember(user: UserWithRoles): boolean {
  return hasActiveRole(user, 'board_member') || isSuperAdmin(user)
}

export function isCommitteeLead(user: UserWithRoles, committeeId?: string): boolean {
  return user.roles.some(r =>
    r.role === 'committee_lead' &&
    !r.revokedAt &&
    (committeeId ? r.contextId === committeeId : true)
  )
}

export function canSendDirectMessages(
  sender: UserWithRoles,
  recipient: { roles: ResidentRole[] }
): boolean {
  if (isBoardMember(sender)) return true
  return !recipient.roles.some(r => r.role === 'board_member')
}

export function canEdit(
  user: AuthUser,
  resource: { createdBy?: string }
): boolean {
  return isBoardMember(user) || resource.createdBy === user.id
}

export function canModerate(user: UserWithRoles): boolean {
  return isBoardMember(user)
}

export function getBoardRank(user: UserWithRoles): number | null {
  const boardRole = user.roles.find(
    r => r.role === 'board_member' && !r.revokedAt && r.rank !== null
  )
  return boardRole?.rank ?? null
}
