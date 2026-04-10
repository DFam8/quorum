// DB-backed per-announcement read tracking.
// The read set is populated from the `isRead` field on each announcement
// returned by the list query, and updated optimistically on markRead.

type AnnouncementLike = { id: string; hidden: boolean; isRead?: boolean }

const readIds = ref(new Set<string>())
let hydrated = false

export function useAnnouncementRead() {
  const api = useApi()

  function hydrate(announcements: AnnouncementLike[]): void {
    for (const a of announcements) {
      if (a.isRead) readIds.value.add(a.id)
    }
    hydrated = true
  }

  function isUnread(announcement: AnnouncementLike): boolean {
    if (announcement.hidden) return false
    return !readIds.value.has(announcement.id)
  }

  function unreadCount(announcements: AnnouncementLike[]): number {
    return announcements.filter(a => isUnread(a)).length
  }

  async function markRead(id: string): Promise<void> {
    if (readIds.value.has(id)) return
    readIds.value.add(id)
    try {
      await api.announcements.markRead.mutate({ id })
    } catch { /* non-critical */ }
  }

  async function markAllRead(announcements: AnnouncementLike[]): Promise<void> {
    const unread = announcements.filter(a => !a.hidden && !readIds.value.has(a.id))
    if (!unread.length) return
    for (const a of unread) readIds.value.add(a.id)
    try {
      await api.announcements.markAllRead.mutate()
    } catch { /* non-critical */ }
  }

  return {
    readIds: readonly(readIds),
    hydrated,
    hydrate,
    isUnread,
    unreadCount,
    markRead,
    markAllRead,
  }
}
