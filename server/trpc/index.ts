import { router } from './procedures'
import { residentsRouter } from './routers/residents'
import { setupRouter } from './routers/setup'
import { unitsRouter } from './routers/units'
import { documentsRouter } from './routers/documents'
import { announcementsRouter } from './routers/announcements'
import { messagesRouter } from './routers/messages'
import { meetingsRouter } from './routers/meetings'
import { minutesRouter } from './routers/minutes'
import { pollsRouter } from './routers/polls'
import { maintenanceRouter } from './routers/maintenance'
import { devRouter } from './routers/dev'

export { router, createTRPCRouter, publicProcedure, authedProcedure, boardProcedure, superAdminProcedure } from './procedures'

export const appRouter = router({
  residents: residentsRouter,
  setup: setupRouter,
  units: unitsRouter,
  documents: documentsRouter,
  announcements: announcementsRouter,
  messages: messagesRouter,
  meetings: meetingsRouter,
  minutes: minutesRouter,
  polls: pollsRouter,
  maintenance: maintenanceRouter,
  dev: devRouter,
})

export type AppRouter = typeof appRouter
