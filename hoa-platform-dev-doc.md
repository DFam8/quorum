# HOA Community Platform — Development Reference

> Solo builder reference document. Generated from full planning session.
> Last updated: April 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Design Principles](#2-core-design-principles)
3. [Feature Modules](#3-feature-modules)
4. [Data Model](#4-data-model)
5. [Roles & Permissions](#5-roles--permissions)
6. [Tech Stack](#6-tech-stack)
7. [MVP Scope](#7-mvp-scope)
8. [User Stories](#8-user-stories)
9. [AI Assist Phase](#9-ai-assist-phase)
10. [Key Decisions Log](#10-key-decisions-log)

---

## 1. Project Overview

A web-first HOA community platform for a mixed community of condos, apartments, and single-family homes. Primary users are homeowners/residents and board members/admins. Designed with an older demographic in mind — friction-free, simple navigation, large touch targets, plain language.

**Single installation per community.** Not multi-tenant.

**First real community:** Ready and waiting. Real feedback loops from day one.

**Core tech:** Nuxt 3 + PostgreSQL (Supabase) + Vercel. Full stack in one repo.

---

## 2. Core Design Principles

### Transparency first
Every significant action leaves a public or auditable trail. Nothing is silently deleted — content is hidden with a reason shown. Board decisions, vote outcomes, approval histories, and AI assist usage are all logged. When something is hidden, residents see a placeholder explaining why.

### Friction-free
Designed for older residents. Magic link auth (no passwords). Minimal form fields. Autosave everywhere. Clear confirmation messages. One obvious action per screen. Board-only controls hidden entirely from residents rather than greyed out.

### Unit → Household → Resident hierarchy
The unit is permanent (physical property, full history preserved). The household is the current occupancy group linked to a unit. The resident is an individual linked to a household. Multiple residents per unit. One primary contact per household. Households detach on move-out; unit history is never deleted.

### Privacy where it matters
Violations are private to the resident and board. Individual vote choices are visible within a household but never between households. Community-wide vote counts and participation rates are public.

---

## 3. Feature Modules

### 3.1 Communication

**Announcements**
- Board/admin post only. Priority levels: urgent and general.
- Urgent bypasses quiet hours — always delivers immediately.
- Pin to top of feed. Author always attributed.
- Edit history preserved. Posts hidden (never deleted), reason shown publicly.
- Notification fires on publish.

**Direct messaging**
- Resident → admin: always on.
- Resident → resident: configurable by the recipient in their profile settings.
- Admin can message individual resident, all residents on a unit, or broadcast.
- Messages hidden (never deleted). Read receipts.
- Board messages to residents trigger mandatory email notification.

**Community forum (v2)**
- Admin creates channels. Moderation mode configurable per channel.
- Any resident can post once they're a member.
- Resident report flag → admin review queue.
- Posts hidden with reason, never deleted. Author always attributed.

**Broadcast + segments (v2)**
- Segments are dynamic, filter-based, auto-updating.
- Filter criteria: unit type, building, owner vs renter, primary vs occupant, engagement attributes (voted, has open maintenance, hasn't logged in X days), move-in date range.
- Segments saved and reusable platform-wide (voting, announcements, notifications).
- Any board member can create and manage segments.
- Broadcast lands in a separate notifications feed, not DM inbox.
- Recipient sees segment label ("sent to all condo owners") but not filter criteria.
- Preview member count before sending.
- Rate limit configurable by Super Admin.

---

### 3.2 Voting

**Vote creation & approval**
- Any board member can create a vote.
- Super Admin must approve before it opens (light confirmation for re-runs).
- Vote fields: title, type, description, threshold %, quorum %, quorum failure mode, deadline, max re-runs.
- Vote types: board election, budget approval, bylaw change, community improvement.

**Eligibility**
- One vote per household. Owners only — renters cannot vote.
- Any resident on a household can cast the ballot. First to vote locks it.
- All residents on a unit can see how their household voted. Other units cannot.
- Clear UI warning shown before casting: "This vote will be visible to all members of your household."

**Voting lifecycle**
- Notification sent to all eligible households when vote opens.
- Reminder nudge to non-voters (timing configurable by Super Admin).
- On deadline: check quorum. If not met → quorum failure mode applies.
- Quorum failure modes: re-run (default), auto-extend (one time, residents notified), Super Admin override.
- Quorum failure mode set per vote at creation time.
- Real-time participation tracker visible to all residents during voting window (count only, not choices).

**Results & acceptance**
- On quorum met: tally results. Check threshold.
- If threshold not met: vote fails, result recorded, goes to archive.
- If threshold met: board acceptance vote (majority required).
- Each board member's acceptance vote is publicly visible in the archive.
- If board does not accept: board notes required, goes to archive with outcome.
- If board accepts: publish result, notify all residents.

**Re-run chain**
- Re-run creates child vote linked to parent via `parent_vote_id`.
- All fields inherited, editable before resubmitting.
- Full chain visible to residents in archive.
- Configurable max re-run attempts (Super Admin).
- Each re-run requires light Super Admin confirmation.
- Once max attempts reached, vote is permanently closed. New attempts start a fresh chain.

**Archive**
- All votes, all outcomes, all re-run chains — publicly visible to residents.
- Board acceptance votes and individual board member decisions visible.

---

### 3.3 Meetings & Minutes

**Meeting scheduling**
- Any board member creates a meeting (title, type, date, time, location).
- Residents notified when scheduled.
- Meeting list shows upcoming and past. Status badges: agenda published, minutes published, minutes in review (board-only).

**Agenda**
- Board builds agenda: add, reorder, remove items. Attach documents.
- Board publishes agenda → visible to all residents. Notification fires.
- Agenda visible before and after meeting.
- Agenda comments: configurable toggle (Super Admin). When enabled, residents can comment on published agenda before the meeting. Comments visible to all residents.

**Minutes drafting**
- Rich text editor with autosave. No manual save needed.
- Import .docx — parsed into native editable format.
- Any board member can edit. Autosaves silently.
- Inactivity timer starts after last save.
- At X hours (Super Admin configured): reminder to last editor only.
- At Y hours (Super Admin configured): escalation to Super Admin.
- Finalize button sends for board review. Warning shown if document already approved.

**Minutes approval**
- Status states: `drafting → in_review → approved → published`.
- Approval mode: majority (default) or single admin — configurable by Super Admin.
- Each board member approves or requests changes with a required reason.
- Reasons visible to all board members. Residents never see approval notes.
- Any board member can edit during review. Saving edits and re-finalizing resets all approvals and increments the round counter.
- System auto-marks approved when majority reached.
- Round number tracked — audit log shows which version each member approved.

**Publishing & archive**
- Board publishes approved minutes → all residents notified.
- Published minutes locked — no further edits.
- Archive ordered by meeting date, publicly visible to all residents.
- Board member approval votes visible in published archive (transparency).

---

### 3.4 Asset Management

**Facility directory**
- Admin creates, edits, archives facilities. (Archived, never deleted — history preserved.)
- Fields: name, description, photos, capacity, status, booking restrictions (configurable per facility), scheduled hours, blackout dates.
- Status: open / closed / under maintenance. Estimated reopen date when closed.
- Status changes notify residents.
- All residents can view facility directory and current status.

**Bookings**
- Residents book directly. First come first served.
- One booking per time slot. General resident access continues during booked events.
- Resident declares guest headcount at booking. System blocks if headcount exceeds capacity.
- All upcoming bookings visible to all residents including booker's name.
- Booking confirmation notification sent.
- Resident can cancel own booking. Admin can override any booking (resident notified with reason, logged in audit).
- No double booking (system enforced).
- Booking history per facility preserved.

**Maintenance requests**
- Any resident can submit a request form (title, description, photos).
- Priority levels: urgent / routine.
- Community-wide open requests visible to all residents.
- Admin assigns and tracks. Resolution notes logged.
- Full maintenance history per facility preserved.

---

### 3.5 Resident Portal

**Profile & unit**
- Resident edits: name, email, phone, notification preferences, directory opt-out.
- Unit details (type, building, floor, move-in date): view only for residents. Admin managed.
- Unit changes require admin approval.

**Household**
- Primary contact can invite additional occupants (up to configurable max set by Super Admin, per-unit override by admin).
- All residents on unit see each other.
- Primary contact is first to accept unit invite. Transferable by admin.

**Resident directory**
- Opt-out by default means listed. Residents toggle their own opt-out.
- Unit listing shows primary contact name. Drill-in shows all occupants.
- Contact info only shown if resident opts in.
- Board members flagged with title.
- Opted-out units show unit number only.
- Message button on each resident in drill-in view.

**Documents library**
- Categories: governing docs, budget & financials, meeting minutes.
- Board members upload and publish documents.
- Version history on all documents — each version has a short change note.
- Residents can download any published document.
- New/Updated badges shown for 30 days after upload.

**Violations (v2)**
- Residents see their own violations only. Private to resident and board.
- Status, resolution notes, notice history.

**HOA fees & payments (stretch goal)**
- Fee schedule, payment history, outstanding balance.
- Requires payment integration — scoped out of v1 and v2.

---

### 3.6 Admin & Board Tools

- Role & permission management (Super Admin only for role changes).
- Resident roster & unit registry.
- Move-in / move-out workflow (triggers invite or role revocation after grace period).
- Violation tracking & notices (v2).
- Meeting agenda, minutes, and approval tools (covered in 3.3).
- Audit log — every significant action, entity before/after snapshots.
- Segments (covered in 3.1).

---

### 3.7 Sub-Committees

**Structure**
- Any board member creates a committee (name, purpose, membership mode).
- Creator is default lead, transferable.
- Active / archived status. History preserved on archive.

**Membership modes**
- Auto-approve: resident requests → instantly approved.
- Manual approve: resident requests → lead approves/declines.
- Invite only: lead sends invites, no self-request.
- Configurable per committee, changeable by lead at any time.

**Membership states**
- `non-member` → read only
- `pending` → request submitted (manual mode only)
- `member` → can read and post
- `removed` → back to read only, notified with reason

**Communication**
- Forum channel: visible to all residents, only members can post.
- Committee lead can post announcements scoped to members or broadcast to full community.
- Posts hidden (never deleted). Author always attributed.
- Lead moderates their own channel.

**Permissions**
- Committee lead permissions are scoped to their committee only.
- Does not elevate their platform-wide access.

---

### 3.8 Notifications & Settings

**Delivery channels**
- Email: on by default.
- In-app: always on, cannot be disabled.
- SMS: opt-in, requires verified phone number.
- Each channel toggleable per notification category.

**Mandatory notifications (cannot be turned off)**
- Violation notices (own unit).
- Vote results (household).
- Emergency / urgent announcements.
- Direct messages from board.

**Optional notification categories**
- General announcements, vote opened/reminder, meeting agenda published, minutes published, maintenance request updates, forum activity, direct messages from residents.

**Batching & timing**
- Urgent: immediate always, bypasses quiet hours.
- Non-urgent: immediate or digest (daily/weekly), resident's choice.
- Digest delivery time configurable by resident.
- Quiet hours: resident sets a window. Urgent bypasses.

**Community-wide settings (Super Admin only)**
- Default notification preferences for new residents.
- Broadcast rate limit.
- Minutes finalize reminder window.
- Minutes escalation window.
- Vote reminder timing.
- Quorum failure behaviour default.
- Max vote re-run attempts.
- Agenda comment toggle.
- Minutes approval mode (majority vs single admin).
- Max occupants per unit.
- Invite link expiry days.
- Board member grace period on move-out.

---

### 3.9 Segments

Platform-wide feature. Covered in section 3.1 (Communication). Segments can be used in:
- Broadcast messaging
- Vote notifications
- Announcement targeting (v2)
- Maintenance alerts (v2)

---

## 4. Data Model

**Database:** PostgreSQL (Supabase managed).

### 4.1 Core Entities

```sql
-- Community (single installation)
Community {
  id            uuid PK
  name          varchar
  address       varchar
  timezone      varchar
  max_super_admins        int
  max_occupants_per_unit  int
  settings      jsonb     -- all Super Admin configurable settings
  created_at    timestamp
}

-- Unit (permanent record, never deleted)
Unit {
  id            uuid PK
  community_id  uuid FK → Community
  unit_number   varchar UNIQUE
  unit_type     enum(condo, apartment, sfh)
  building      varchar
  floor         int
  notes         text
  created_at    timestamp
}

-- Household (current occupancy group, linked to unit)
Household {
  id                  uuid PK
  unit_id             uuid FK → Unit
  primary_resident_id uuid FK → Resident
  status              enum(active, moved_out)
  move_in_date        date
  move_out_date       date
  created_at          timestamp
}

-- Resident (individual person)
Resident {
  id                uuid PK
  household_id      uuid FK → Household
  email             varchar UNIQUE
  phone             varchar
  first_name        varchar
  last_name         varchar
  resident_type     enum(owner, renter)
  directory_opt_out boolean
  invite_status     enum(pending, accepted, expired)
  invite_token      varchar
  invite_expires_at timestamp
  last_login_at     timestamp
  created_at        timestamp
}

-- ResidentRole (platform & committee roles)
-- context_type=community → platform-wide role
-- context_type=committee → scoped to committee
ResidentRole {
  id            uuid PK
  resident_id   uuid FK → Resident
  role          enum(super_admin, board_member, committee_lead)
  rank          int           -- 1=President, 2=VP, 3=Officer, 4=Member (board_member only)
  title         varchar       -- free text informal label
  context_id    uuid          -- community_id or committee_id
  context_type  enum(community, committee)
  temporary     boolean       -- true during board handoff
  temporary_reason varchar
  granted_by    uuid FK → Resident
  granted_at    timestamp
  revoked_at    timestamp
}
-- Unique constraint: (community_id, rank) WHERE rank IN (1,2,3)
```

### 4.2 Governance Entities

```sql
-- Meeting
Meeting {
  id            uuid PK
  community_id  uuid FK → Community
  title         varchar
  meeting_type  varchar
  location      varchar
  scheduled_at  timestamp
  status        enum(scheduled, held, cancelled)
  created_by    uuid FK → Resident
  created_at    timestamp
}

-- Agenda
Agenda {
  id                uuid PK
  meeting_id        uuid FK → Meeting
  status            enum(draft, published)
  comments_enabled  boolean
  published_at      timestamp
  items             jsonb     -- ordered list of agenda items + attachments
  created_at        timestamp
}

-- AgendaComment
AgendaComment {
  id          uuid PK
  agenda_id   uuid FK → Agenda
  resident_id uuid FK → Resident
  body        text
  hidden      boolean
  hidden_reason text
  created_at  timestamp
}

-- Minutes
Minutes {
  id                  uuid PK
  meeting_id          uuid FK → Meeting
  status              enum(drafting, in_review, approved, published)
  body                text
  imported_doc_url    varchar
  last_edited_by      uuid FK → Resident
  last_edited_at      timestamp
  finalized_at        timestamp
  published_at        timestamp
  reminder_sent_at    timestamp
  escalation_sent_at  timestamp
}

-- MinutesApproval (one row per board member per round)
MinutesApproval {
  id          uuid PK
  minutes_id  uuid FK → Minutes
  resident_id uuid FK → Resident
  decision    enum(approved, changes_requested)
  round       int           -- increments when edits reset approvals
  notes       text
  voted_at    timestamp
}

-- Vote
Vote {
  id                  uuid PK
  community_id        uuid FK → Community
  parent_vote_id      uuid FK → Vote  -- self-reference for re-run chain
  run_number          int
  vote_type           enum(election, budget, bylaw, improvement)
  title               varchar
  description         text
  threshold_pct       decimal
  quorum_pct          decimal
  quorum_failure_mode enum(rerun, auto_extend, super_admin_override)
  max_reruns          int
  status              enum(pending_approval, open, closed, failed, accepted, published)
  opens_at            timestamp
  closes_at           timestamp
  created_by          uuid FK → Resident
  approved_by         uuid FK → Resident
}

-- Ballot (one per household per vote)
Ballot {
  id            uuid PK
  vote_id       uuid FK → Vote
  household_id  uuid FK → Household
  cast_by       uuid FK → Resident
  choice        enum(yes, no, abstain)
  cast_at       timestamp
}

-- BoardAcceptance (board vote on whether to accept result)
BoardAcceptance {
  id          uuid PK
  vote_id     uuid FK → Vote
  resident_id uuid FK → Resident
  decision    enum(accepted, not_accepted)
  notes       text
  voted_at    timestamp
}
```

### 4.3 Community Entities

```sql
-- Facility
Facility {
  id                    uuid PK
  community_id          uuid FK → Community
  name                  varchar
  description           text
  capacity              int
  status                enum(open, closed, under_maintenance)
  booking_restrictions  jsonb
  hours                 jsonb
  archived_at           timestamp
}

-- Booking
Booking {
  id            uuid PK
  facility_id   uuid FK → Facility
  household_id  uuid FK → Household
  booked_by     uuid FK → Resident
  starts_at     timestamp
  ends_at       timestamp
  guest_count   int
  notes         text
  status        enum(confirmed, cancelled, overridden)
  cancelled_by  uuid FK → Resident
  cancel_reason text
}

-- MaintenanceRequest
MaintenanceRequest {
  id              uuid PK
  facility_id     uuid FK → Facility
  submitted_by    uuid FK → Resident
  assigned_to     uuid FK → Resident
  title           varchar
  description     text
  photo_urls      jsonb
  priority        enum(urgent, routine)
  status          enum(open, in_progress, resolved)
  resolution_notes text
  resolved_at     timestamp
  created_at      timestamp
}

-- SubCommittee
SubCommittee {
  id                uuid PK
  community_id      uuid FK → Community
  name              varchar
  purpose           text
  lead_resident_id  uuid FK → Resident
  membership_mode   enum(auto_approve, manual, invite_only)
  status            enum(active, archived)
  archived_at       timestamp
  created_by        uuid FK → Resident
  created_at        timestamp
}

-- CommitteeMember
CommitteeMember {
  id              uuid PK
  committee_id    uuid FK → SubCommittee
  resident_id     uuid FK → Resident
  status          enum(pending, member, removed)
  invited_by      uuid FK → Resident
  joined_at       timestamp
  removed_at      timestamp
  removal_reason  text
}

-- Segment (dynamic filter-based group)
Segment {
  id                uuid PK
  community_id      uuid FK → Community
  name              varchar
  created_by        uuid FK → Resident
  filter_criteria   jsonb   -- stored filter rules, evaluated at query time
  last_evaluated_at timestamp
  created_at        timestamp
}

-- Notification (one row per resident per channel)
Notification {
  id          uuid PK
  resident_id uuid FK → Resident
  category    enum(urgent_announcement, violation, vote_result, board_dm,
                   general_announcement, vote_reminder, agenda_published,
                   minutes_published, maintenance_update, forum_activity, dm)
  channel     enum(email, in_app, sms)
  subject     varchar
  body        text
  mandatory   boolean
  status      enum(queued, sent, delivered, failed)
  sent_at     timestamp
  read_at     timestamp
}

-- AuditLog (polymorphic, covers every entity)
AuditLog {
  id            uuid PK
  community_id  uuid FK → Community
  actor_id      uuid FK → Resident
  action        varchar
  entity_type   varchar
  entity_id     uuid
  before        jsonb
  after         jsonb
  ip_address    varchar
  created_at    timestamp
}
```

### 4.4 AI Assist Fields

Added to message/announcement tables:

```sql
-- Additional fields on announcements, direct messages, broadcast messages
ai_assisted     boolean
ai_mode         enum(polish, rewrite, suggest)
ai_tone         enum(formal, friendly, neutral)
ai_input        text        -- original draft or short prompt
ai_input_type   enum(draft, prompt)
```

---

## 5. Roles & Permissions

### Role hierarchy

| Role | Scope | Notes |
|------|-------|-------|
| Super Admin | Community-wide | Board president. Configurable max count. Rank 1. |
| Board member | Community-wide | Ranks 1–4. Renters cannot hold board roles. Must be active owner-resident. |
| Committee lead | Committee-scoped | Elevated only within their committee. Does not affect platform-wide access. |
| Primary contact | Household | First resident to accept unit invite. Transferable by admin. |
| Occupant | Household | All other residents on a unit. |

### Board rank hierarchy

| Rank | Role | Notes |
|------|------|-------|
| 1 | President | Super Admin. Unique. |
| 2 | VP | Unique. Auto-elevated on president move-out. |
| 3 | Third officer | Unique. Auto-elevated if rank 2 vacant. |
| 4 | Board member | Multiple allowed. No ordering between them. |

### Board handoff on move-out

1. Grace period starts (configurable, Super Admin sets).
2. At grace period expiry: role revoked.
3. If rank 1 moves out → rank 2 auto-elevated (temporary flag set).
4. If rank 2 unavailable → rank 3 auto-elevated.
5. If rank 3 unavailable → manual resolution required. Alert fires to all board members.
6. Super Admin must formally appoint replacement. Temporary flag cleared.
7. Proactive alert fires when ranks 2 or 3 are vacant (not just at crisis time).
8. Renters cannot hold any board rank.

### Permissions matrix (summary)

| Action | Super Admin | Board member | Committee lead | Primary | Occupant |
|--------|-------------|--------------|----------------|---------|----------|
| Post announcements | ✓ | ✓ | — | — | — |
| Send broadcast | ✓ | ✓ | Own committee | — | — |
| Create/manage segments | ✓ | ✓ | — | — | — |
| Post in forum | ✓ | ✓ | ✓ | ✓ | ✓ |
| Moderate/hide posts | ✓ | ✓ | Own committee | — | — |
| Create a vote | ✓ | ✓ | — | — | — |
| Approve vote proposal | ✓ only | — | — | — | — |
| Cast household vote | ✓ | ✓ | ✓ | ✓ | ✓ |
| Board acceptance vote | ✓ | ✓ | — | — | — |
| Create/schedule meeting | ✓ | ✓ | — | — | — |
| Draft/edit minutes | ✓ | ✓ | — | — | — |
| Approve minutes | ✓ | ✓ | — | — | — |
| View published minutes | ✓ | ✓ | ✓ | ✓ | ✓ |
| Configure meeting settings | ✓ only | — | — | — | — |
| Add/edit/archive facilities | ✓ | ✓ | — | — | — |
| Book a facility | ✓ | ✓ | ✓ | ✓ | ✓ |
| Override any booking | ✓ | ✓ | — | — | — |
| Submit maintenance request | ✓ | ✓ | ✓ | ✓ | ✓ |
| Assign/resolve maintenance | ✓ | ✓ | — | — | — |
| Edit own contact info | ✓ | ✓ | Own | Own | Own |
| Edit unit details | ✓ | ✓ | — | — | — |
| Invite occupants to unit | ✓ | ✓ | ✓ | ✓ | — |
| View all violations | ✓ | ✓ | — | — | — |
| View own violations | ✓ | ✓ | Own | Own | Own |
| Upload documents | ✓ | ✓ | — | — | — |
| Assign/change roles | ✓ only | — | — | — | — |
| View audit log | ✓ | ✓ | — | — | — |
| Set community-wide settings | ✓ only | — | — | — | — |
| Create sub-committee | ✓ | ✓ | — | — | — |
| Manage committee membership | ✓ | ✓ | Own committee | — | — |

---

## 6. Tech Stack

### Selected stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Nuxt 3 + Vue 3 | Familiar, AI-friendly, SSR built in |
| Language | TypeScript | Throughout |
| Styling | Tailwind CSS | |
| State | Pinia | |
| Backend | Nuxt server routes (Nitro) | Single repo, no separate API server |
| API layer | tRPC | Type-safe end to end |
| ORM | Drizzle | Lightweight, type-safe |
| Database | PostgreSQL via Supabase | Managed, free tier to start |
| Auth | Supabase Auth | Magic link (no password). Free. Invite flow built in. |
| File storage | Supabase Storage | Docs, photos, imported .docx files |
| Email | Resend | 3,000 emails/mo free |
| SMS | Twilio | Pay per use, ~$0.0079/SMS |
| Background jobs | Inngest | Timers, reminders, escalations, vote deadlines |
| Hosting | Vercel | Nuxt deploys perfectly, free hobby tier |
| AI assist | Anthropic Claude API (Haiku) | Phase 2. Near-zero cost at community scale. |

### Cost estimate

| Stage | Monthly cost |
|-------|-------------|
| Launch | ~$0–2 (SMS only) |
| Growing (250–500 units) | ~$25 (Supabase Pro) |
| Mature (500+ units) | ~$65 (Supabase Pro + Vercel Pro + email + SMS) |

### Important notes

- **Supabase free tier pauses DB after 7 days inactivity.** Upgrade to Pro ($25/mo) before going live.
- **PostgreSQL preferred over MySQL** for JSONB support (segment filter criteria, notification preferences, facility settings).
- **Magic link auth** is the right choice for older demographic. No password friction.
- **Inngest** handles all the configurable timers we built: minutes reminder, escalation, vote deadline, grace period, invite expiry.

---

## 7. MVP Scope

### v1 — Core platform (build first)

| Module | Included | Excluded |
|--------|----------|---------|
| Onboarding & auth | Bulk CSV invite, unit invite link, magic link auth, profile setup, role assignment, board hierarchy | — |
| Communication | Announcements, direct messaging (resident ↔ admin + resident ↔ resident), email notifications | Forum, broadcast, segments, SMS |
| Meetings & minutes | Full lifecycle — schedule, agenda, autosave editor, .docx import, board approval, publish, archive | Agenda comments |
| Resident portal | Profile, unit details, document library, directory | Violations, maintenance requests |

### v2 — Engagement layer

- Voting (full lifecycle)
- Communication: forum, moderation, broadcast, segments, agenda comments, SMS
- Asset management: facilities, bookings, maintenance requests
- Admin tools: violations, move-in/move-out workflow, full audit log

### v3 — Full platform

- Sub-committees
- Platform-wide segments
- HOA fees & payments (stretch, requires payment integration)
- Mobile PWA polish
- Advanced reporting

### Recommended v1 build order

1. Onboarding & auth (everything depends on this)
2. Resident portal (lowest effort, high value)
3. Communication core
4. Meetings & minutes (most complex — save for last in v1)

---

## 8. User Stories

Stories follow format: `As a [role], I want to [action] so that [benefit]`

Priority levels: **Must have** · Should have · Phase 2

---

### 8.1 Onboarding & Auth

| ID | Story | Role | Priority |
|----|-------|------|----------|
| OA-01 | Configure community name, address, timezone, and platform settings | Super Admin | Must have |
| OA-02 | Upload a CSV of units and resident emails to onboard the entire community in one action | Super Admin | Must have |
| OA-03 | Assign board member roles and ranks (1–4) to specific residents | Super Admin | Must have |
| OA-04 | Send a unit-level invite link to a specific unit's email | Super Admin / Board | Must have |
| OA-05 | Expire invite links after a configurable number of days | System | Must have |
| OA-06 | Resend or reset a unit's invite link | Super Admin / Board | Must have |
| OA-07 | Click an invite link and sign in with a magic link sent to my email (no password) | Resident | Must have |
| OA-08 | Complete a simple welcome flow (name, phone, notification preferences) after first login | Resident | Must have |
| OA-09 | Invite additional occupants to my unit from my profile | Primary contact | Must have |
| OA-10 | Enforce a maximum occupant count per unit | System | Must have |
| OA-11 | Assign and update board member ranks (1–4) and informal titles | Super Admin | Must have |
| OA-12 | Automatically elevate the next ranked board member to temporary Super Admin when current Super Admin moves out, after grace period | System | Must have |
| OA-13 | Alert the Super Admin when board ranks 2 or 3 are vacant | System | Should have |
| OA-14 | Process a move-out for a unit — mark household inactive, queue role revocation, preserve history | Super Admin / Board | Must have |

---

### 8.2 Resident Portal

| ID | Story | Role | Priority |
|----|-------|------|----------|
| RP-01 | View and edit my name, email, and phone number | Resident | Must have |
| RP-02 | Set notification preferences and quiet hours | Resident | Must have |
| RP-03 | Opt out of the resident directory | Resident | Must have |
| RP-04 | View my unit details | Resident | Must have |
| RP-05 | Browse the resident directory | Resident | Must have |
| RP-06 | See which residents are board members and their titles | Resident | Must have |
| RP-07 | Drill into a unit listing and see all occupants | Resident | Should have |
| RP-08 | Browse and download governing documents | Resident | Must have |
| RP-09 | Access published meeting agendas and minutes | Resident | Must have |
| RP-10 | Access budget and financial reports | Resident | Must have |
| RP-11 | See version history on governing documents | Resident | Should have |
| RP-12 | Upload and publish documents to the library | Board member | Must have |
| RP-13 | View a unit's full occupancy history | Board member | Must have |
| RP-14 | Edit unit details | Board member | Must have |
| RP-15 | See open items on my unit when I first log in | Resident | Should have |

---

### 8.3 Communication Core

| ID | Story | Role | Priority |
|----|-------|------|----------|
| CM-01 | Create and publish an announcement with a priority level (urgent or general) | Board member | Must have |
| CM-02 | Pin an announcement to the top of the feed | Board member | Must have |
| CM-03 | Edit a published announcement with edit history preserved | Board member | Must have |
| CM-04 | Browse all announcements in a feed ordered by recency | Resident | Must have |
| CM-05 | Send an email notification to all residents when a new announcement is published | System | Must have |
| CM-06 | Bypass quiet hours and send immediate notification for urgent announcements | System | Must have |
| CM-07 | Send a direct message to a board member or admin | Resident | Must have |
| CM-08 | Send a direct message to an individual resident or all residents on a unit | Board member | Must have |
| CM-09 | Configure whether other residents can send me direct messages | Resident | Must have |
| CM-10 | Send a direct message to another resident (if they haven't disabled it) | Resident | Must have |
| CM-11 | Show read receipts on direct messages | System | Should have |
| CM-12 | Send email notification when a resident receives a direct message from a board member | System | Must have |
| CM-13 | Hide a message or post with a required reason | Board member | Must have |
| CM-14 | Show "this post was hidden by a moderator" placeholder with reason | System | Must have |
| CM-15 | Notify the author when their message is hidden, with reason | System | Must have |
| CM-16 | Show an unread notification count badge in the app | Resident | Must have |
| CM-17 | View a chronological list of notifications in-app | Resident | Must have |

---

### 8.4 Meetings & Minutes

| ID | Story | Role | Priority |
|----|-------|------|----------|
| MM-01 | Create a meeting with title, type, date, time, and location | Board member | Must have |
| MM-02 | See all upcoming and past meetings in a list | Resident | Must have |
| MM-03 | Notify all residents when a new meeting is scheduled | System | Must have |
| MM-04 | Build a meeting agenda by adding, reordering, and removing items | Board member | Must have |
| MM-05 | Attach documents to agenda items | Board member | Should have |
| MM-06 | Publish the agenda — becomes visible to all residents | Board member | Must have |
| MM-07 | Notify all residents when an agenda is published | System | Must have |
| MM-08 | View the published agenda before and after the meeting | Resident | Must have |
| MM-09 | Write meeting minutes in a rich text editor that autosaves | Board member | Must have |
| MM-10 | Finalize the minutes draft to send for board review, with warning if already approved | Board member | Must have |
| MM-11 | Send a reminder to the last editor if minutes remain unfinalized after X hours | System | Must have |
| MM-12 | Send escalation notification to Super Admin if minutes still unfinalized after Y hours | System | Must have |
| MM-13 | Approve or request changes on finalized minutes | Board member | Must have |
| MM-14 | Reset all board approvals and notify board when any board member edits and re-finalizes | System | Must have |
| MM-15 | Track approval rounds so audit log shows which version each member approved | System | Must have |
| MM-16 | Auto-mark minutes as approved when majority reached | System | Must have |
| MM-17 | Publish approved minutes — visible to all residents in archive | Board member | Must have |
| MM-18 | Notify all residents when minutes are published | System | Must have |
| MM-19 | Browse the published minutes archive ordered by meeting date | Resident | Must have |
| MM-20 | Lock published minutes from further edits | System | Must have |
| MM-21 | See which board members approved each version of the minutes | All | Must have |

---

## 9. AI Assist Phase

### Overview

AI writing assistance integrated into communication composers. Powered by Anthropic Claude API (Haiku model). Near-zero cost at community scale (~$0.0004 per assist, ~$0.40/mo for 1,000 assists).

### Modes

| Mode | Description | Works on |
|------|-------------|----------|
| Polish | Fix grammar, spelling, clarity. Preserve original meaning. | Selected text or full message |
| Rewrite | Change formality, tone, or length. | Full message only |
| Suggest | Generate full message from a short prompt. | Empty or partial editor |

### Tone options
Formal · Friendly · Neutral — user picks before generating.

### UI pattern
- Toolbar button alongside Bold, Italic etc. (same visual weight, not oversized).
- Panel opens below editor showing mode selector, tone selector, and input (for Suggest mode).
- AI suggestion inserted below original content.
- Accept replaces original. Reject restores original. Regenerate tries again.

### Phase 1 surfaces
- Announcement composer
- Direct message compose
- Broadcast message compose
- Available to all users (board members and residents)

### Phase 2 surfaces
- Minutes editor: polish notes into formal minutes, suggest structure from agenda, summarize sections
- Violation notices: generate formal notice from violation type + bylaw reference (board only, tone always formal)
- Agenda builder: suggest items from past meetings, flesh out descriptions (board only)
- Maintenance requests: help residents describe issues clearly, suggest priority level

### Transparency & audit rules

**Visible to sender only** — subtle "AI assisted" indicator in their sent message view. Recipients never see it.

**Logged in audit trail** — every AI-assisted message records:
- `ai_assisted` boolean
- `ai_mode` (polish / rewrite / suggest)
- `ai_tone` (formal / friendly / neutral)
- `ai_input` (original draft or prompt text)
- `ai_input_type` (draft / prompt)

**Not visible to recipients** — no badge, no label. The sender is accountable for the content.

**Always user-initiated** — AI never generates or sends content automatically. User reviews and accepts before anything goes out.

**No content stored by AI layer** — use Anthropic zero data retention option for API calls containing resident communications.

### Context passed to Claude API

Every assist call includes in the system prompt:
- Message type (announcement / direct message / broadcast)
- Recipient context (individual / unit / all residents / segment name)
- Community name
- Selected tone
- Mode-specific instruction

### User stories

| ID | Story | Role | Priority |
|----|-------|------|----------|
| AI-01 | See an AI assist button in the message toolbar | All users | Must have |
| AI-02 | Choose between Polish, Rewrite, and Suggest modes | All users | Must have |
| AI-03 | Select a tone (formal, friendly, neutral) before generating | All users | Must have |
| AI-04 | See AI suggestion inserted below original content | All users | Must have |
| AI-05 | Accept a suggestion — replaces original in editor | All users | Must have |
| AI-06 | Reject a suggestion — original restored untouched | All users | Must have |
| AI-07 | Regenerate if first suggestion isn't right | All users | Must have |
| AI-08 | Polish mode fixes grammar and clarity while preserving meaning | All users | Must have |
| AI-09 | Polish mode works on selected text or full message | All users | Should have |
| AI-10 | Rewrite mode restructures full message with selected tone | All users | Must have |
| AI-11 | Rewrite mode offers shorter or longer version | All users | Should have |
| AI-12 | Suggest mode generates full message from short prompt | All users | Must have |
| AI-13 | System passes message type and recipient context to AI | System | Must have |
| AI-14 | Sender sees subtle AI assisted indicator on their sent message | Sender | Must have |
| AI-15 | System logs AI mode, tone, original input, and accepted content | System | Must have |
| AI-16 | Super Admin/board can see AI assist usage in audit log | Super Admin / Board | Must have |
| AI-17 | System stores original draft/prompt separately from accepted content | System | Must have |
| AI-18 | AI assisted indicator never shown to message recipients | System | Must have |
| AI-19 | AI assist in minutes editor to polish notes into formal minutes | Board member | Phase 2 |
| AI-20 | AI suggests agenda items based on past meetings | Board member | Phase 2 |
| AI-21 | AI generates formal violation notice from violation type + bylaw | Board member | Phase 2 |
| AI-22 | AI assist in maintenance request form to help describe issues | Resident | Phase 2 |
| AI-23 | AI suggests priority level for maintenance request from description | Board member | Phase 2 |

---

## 10. Key Decisions Log

A record of every significant design decision made during planning.

### Community & structure
- Single-tenant: one installation per HOA community.
- Mixed community supported: condo, apartment, SFH.
- Unit → Household → Resident hierarchy. Units are permanent records.
- One vote per household. Owners only can vote. First to cast locks the ballot.
- All residents on a unit can see how their household voted. Not visible between units.

### Roles
- Five role types: Super Admin, board member, committee lead (committee-scoped), primary contact, occupant.
- Residents have two parallel attributes: resident_type (owner/renter) and platform role (separate concerns).
- Committee lead is contextual — no platform-wide elevation.
- Board rank: 1 (President/Super Admin, unique), 2 (VP, unique), 3 (Officer, unique), 4 (all others, multiple).
- Renters cannot hold board roles.
- Board members must be active owner-residents.

### Voting
- Ballots are always anonymous between households. Visible within household.
- Results published automatically? No — board acceptance vote required first.
- Quorum failure: vote fails and must be re-run (default). Configurable per vote.
- Re-run chain: child votes linked to parent via parent_vote_id. Chain visible in archive.
- Max re-run attempts: configurable by Super Admin.
- Fresh chain starts if vote hits max attempts and someone creates a new one.
- Board acceptance votes publicly visible in archive (individual board member choices shown).

### Meetings & minutes
- Agenda comments: configurable toggle per community. Default off.
- Minutes editor: autosave. Finalize triggers board review. No notifications during drafting.
- Reminder to last editor at X hours. Escalation to Super Admin at Y hours. Both configurable.
- Edit after finalization resets all approvals. Warning shown before finalizing.
- Approval round tracked — round counter increments on each edit/re-finalize cycle.
- Minutes locked after publish. No further edits.
- Board approval votes on minutes visible to all residents in published archive.
- Word doc import: .docx parsed into native editor format. Full approval workflow applies.

### Communication
- Posts/messages: hidden (never deleted). Reason shown publicly as placeholder.
- Resident → resident messaging: configurable by recipient in their profile.
- Broadcast: lands in separate notifications feed, not DM inbox.
- Segments: dynamic, filter-based, saved, reusable platform-wide.
- Segments created by any board member.
- Announcement priority: urgent bypasses quiet hours. General does not.

### Asset management
- Facility bookings: one booking per time slot. General access continues during booked events.
- Booking visibility: all residents see all upcoming bookings including booker's name.
- Admin override on bookings: resident notified with reason, logged in audit.
- Capacity enforced via declared guest headcount at booking time.

### Onboarding
- Magic link auth. No passwords. 24-hour link expiry.
- Bulk CSV invite for initial setup.
- Unit-level invite link for ongoing move-ins.
- Primary contact = first to accept unit invite.
- Primary contact can invite occupants. Admin can too.
- Max occupants per unit: configurable by Super Admin, per-unit override by admin.

### AI assist
- Three modes: polish, rewrite, suggest.
- Three tones: formal, friendly, neutral.
- Suggestion presented below original — accept or reject.
- AI assisted indicator: visible to sender only. Never shown to recipients.
- Audit log captures: mode, tone, original input, input type (draft vs prompt), accepted content.
- No content stored by AI layer — use zero data retention API option.
- Phase 1: communications only. Phase 2: minutes, violations, agenda, maintenance.

### Tech
- PostgreSQL (Supabase) over MySQL. Better JSONB support for segment criteria and settings.
- Nuxt 3 + Vue 3 over React/Next. Existing familiarity. SSR. AI tooling works equally well.
- Single repo: frontend + backend in Nuxt/Nitro. Simpler to deploy solo.
- Inngest for all background jobs and timers.
- Anthropic Claude Haiku for AI assist. Near-zero cost.

---

*End of document.*

---

## 11. Design System

### Project name
**Quorum**

### UI stack
- **Radix Vue** — interactive primitives (modals, dropdowns, toggles, tabs, toasts, select, checkbox, slider)
- **Tiptap** — rich text editor for minutes, announcements, and message composers
- **TanStack Table** — data tables (resident roster, audit log, maintenance requests)
- **Vue Datepicker** — date/time picking for meeting scheduling, vote deadlines, booking calendar
- **Scoped component CSS** — all visual styling, 100% custom
- **CSS custom properties** — design tokens (single source of truth)

No Tailwind. No component framework with visual opinions. Total visual control.

---

### CSS custom properties (token file)

```css
:root {
  /* Gradient — signature. Used sparingly: logo mark, primary CTA, onboarding hero */
  --gradient-brand: linear-gradient(135deg, #4F7FFF 0%, #7C3AFF 50%, #FF6B9D 100%);
  --gradient-brand-subtle: linear-gradient(135deg, #4F7FFF 0%, #7C3AFF 100%);

  /* Blue — primary color ramp */
  --blue-50:  #EEF4FF;
  --blue-100: #C5D8FF;
  --blue-200: #7FADFF;
  --blue-400: #4F7FFF;
  --blue-600: #2563EB;
  --blue-800: #1A3DA8;
  --blue-900: #0F1F6B;

  /* Neutral — slate ramp */
  --slate-50:  #F8FAFC;
  --slate-100: #F1F5F9;
  --slate-200: #E2E8F0;
  --slate-300: #CBD5E1;
  --slate-400: #94A3B8;
  --slate-600: #64748B;
  --slate-800: #334155;
  --slate-900: #1A2B4A;

  /* Surfaces */
  --surface-page:   #F8FAFC;   /* page background */
  --surface-card:   #FFFFFF;   /* card / raised element */
  --surface-raised: #F1F5F9;   /* secondary surface, metric cards */
  --surface-nav:    #0F1B2D;   /* sidebar navigation */

  /* Text */
  --text-primary:   #1A2B4A;   /* headings, body */
  --text-secondary: #64748B;   /* labels, meta */
  --text-tertiary:  #94A3B8;   /* hints, placeholders */
  --text-inverse:   #FFFFFF;   /* text on dark backgrounds */
  --text-link:      #4F7FFF;   /* links, info actions */

  /* Border */
  --border-subtle:  #F1F5F9;   /* very light dividers */
  --border-default: #E2E8F0;   /* card borders, default */
  --border-strong:  #CBD5E1;   /* emphasis borders */
  --border-focus:   #4F7FFF;   /* focus rings */

  /* Semantic */
  --success-bg:   #DCFCE7;
  --success-text: #166534;
  --success-mid:  #22C55E;

  --warning-bg:   #FEF9C3;
  --warning-text: #854D0E;
  --warning-mid:  #EAB308;

  --danger-bg:    #FEE2E2;
  --danger-text:  #991B1B;
  --danger-mid:   #EF4444;

  --info-bg:      #EEF4FF;
  --info-text:    #1E40AF;
  --info-mid:     #4F7FFF;

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 15px;
  --text-lg:   18px;
  --text-xl:   22px;
  --text-2xl:  28px;
  --font-normal: 400;
  --font-medium: 500;
  --line-height-tight:  1.3;
  --line-height-normal: 1.6;
  --line-height-loose:  1.8;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;
  --space-10: 64px;

  /* Border radius */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   14px;
  --radius-xl:   20px;
  --radius-full: 9999px;

  /* Shadows — used only for focus rings, no decorative shadows */
  --shadow-focus: 0 0 0 3px rgba(79, 127, 255, 0.25);

  /* Transitions */
  --transition-fast:   150ms ease;
  --transition-normal: 200ms ease;
}
```

---

### Typography rules
- **Two weights only:** 400 (normal) and 500 (medium). Never 600 or 700.
- **Font:** Inter (Google Fonts, free). Load only weights 400 and 500.
- **Sizes:** xs=11px (labels, badges), sm=13px (meta, captions), base=15px (body), lg=18px (section headings), xl=22px (page titles).
- **Text primary** is `#1A2B4A` — deep navy, not pure black. Warmer, ties to blue family.
- **Line height:** 1.3 for headings, 1.6 for body, 1.8 for long-form content (minutes, documents).

---

### Gradient usage rules
The brand gradient is used in **maximum two places** per screen:
1. Logo mark / wordmark in the sidebar
2. Primary CTA button (one per screen maximum)

Never use the gradient on: backgrounds, cards, badges, borders, text, icons, or decorative elements. Everywhere else is flat. The restraint is what makes it feel intentional.

---

### Layout
- **Sidebar navigation:** dark navy (`--surface-nav`), always visible on desktop, collapses to bottom nav on mobile.
- **Content area:** page background (`--surface-page`), cards use `--surface-card`.
- **Sidebar width:** 220px desktop, collapsed to icon-only at 64px on tablet.
- **Content max-width:** 1100px centered.
- **Card borders:** `0.5px solid var(--border-default)` — thin, refined.
- **No box shadows** on cards. Border only.

---

### Component patterns

**Cards**
```css
.card {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
}
```

**Primary button (gradient)**
```css
.btn-primary {
  background: var(--gradient-brand-subtle);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.btn-primary:hover { opacity: 0.9; }
```

**Secondary button (flat)**
```css
.btn-secondary {
  background: var(--surface-card);
  color: var(--text-primary);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.btn-secondary:hover { background: var(--surface-raised); }
```

**Badge / pill**
```css
.badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
}
.badge-info    { background: var(--info-bg);    color: var(--info-text); }
.badge-success { background: var(--success-bg); color: var(--success-text); }
.badge-warning { background: var(--warning-bg); color: var(--warning-text); }
.badge-danger  { background: var(--danger-bg);  color: var(--danger-text); }
```

**Form input**
```css
.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  font-family: var(--font-sans);
  color: var(--text-primary);
  background: var(--surface-card);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast);
}
.input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}
```

---

### Accessibility notes
- **Older demographic:** minimum touch target 44×44px. Font never below 13px in production UI.
- **Focus rings:** always visible, uses `--shadow-focus` (blue glow). Never `outline: none` without replacement.
- **Color contrast:** all text/background combinations meet WCAG AA (4.5:1 minimum).
- **Radix Vue** handles ARIA roles, keyboard navigation, and focus management for all interactive primitives.

---

*End of document.*

---

## 12. Project Structure

```
quorum/
├── .cursor/
│   └── rules                    # Cursor coding conventions (see section 13)
├── assets/
│   ├── tokens.css               # CSS custom properties (design tokens)
│   └── main.css                 # Global resets and base styles
├── components/
│   ├── base/                    # Primitive components (wrap Radix Vue)
│   │   ├── BaseButton.vue
│   │   ├── BaseInput.vue
│   │   ├── BaseSelect.vue
│   │   ├── BaseToggle.vue
│   │   ├── BaseModal.vue
│   │   ├── BaseDropdown.vue
│   │   ├── BaseBadge.vue
│   │   ├── BaseToast.vue
│   │   └── BaseAvatar.vue
│   ├── layout/                  # Layout singletons
│   │   ├── TheNavbar.vue        # Top bar (mobile)
│   │   ├── TheSidebar.vue       # Left nav (desktop)
│   │   └── TheToastContainer.vue
│   ├── announcements/
│   │   ├── AnnouncementCard.vue
│   │   ├── AnnouncementFeed.vue
│   │   └── AnnouncementCompose.vue
│   ├── meetings/
│   │   ├── MeetingCard.vue
│   │   ├── MeetingList.vue
│   │   ├── MeetingDetail.vue
│   │   ├── AgendaBuilder.vue
│   │   └── MinutesEditor.vue
│   ├── messaging/
│   │   ├── MessageThread.vue
│   │   ├── MessageInbox.vue
│   │   └── MessageCompose.vue
│   ├── portal/
│   │   ├── ProfileCard.vue
│   │   ├── UnitCard.vue
│   │   ├── HouseholdMembers.vue
│   │   ├── DocumentLibrary.vue
│   │   └── DirectoryList.vue
│   ├── dashboard/
│   │   ├── ResidentDashboard.vue
│   │   ├── BoardDashboard.vue
│   │   ├── MetricCard.vue
│   │   └── PendingActionCard.vue
│   ├── onboarding/
│   │   ├── InviteLanding.vue
│   │   ├── MagicLinkSent.vue
│   │   ├── ProfileSetup.vue
│   │   ├── NotificationSetup.vue
│   │   └── AdminSetup.vue
│   └── ai/
│       ├── AiAssistPanel.vue
│       └── AiSuggestion.vue
├── composables/
│   ├── useAuth.ts               # Current user, session, role helpers
│   ├── useToast.ts              # Toast notification trigger
│   ├── useAiAssist.ts           # Claude API assist calls
│   └── useNotifications.ts     # In-app notification state
├── layouts/
│   ├── default.vue              # Authenticated layout (sidebar + content)
│   ├── auth.vue                 # Unauthenticated layout (centered, minimal)
│   └── board.vue                # Board dashboard layout
├── middleware/
│   ├── auth.ts                  # Redirect if not authenticated
│   ├── board-only.ts            # Redirect if not board member
│   └── super-admin-only.ts      # Redirect if not super admin
├── pages/
│   ├── index.vue                # Redirects to /dashboard
│   ├── login.vue                # Magic link entry
│   ├── onboarding/
│   │   ├── index.vue            # Profile setup
│   │   └── notifications.vue    # Notification preferences
│   ├── dashboard.vue            # Resident or board dashboard
│   ├── announcements/
│   │   ├── index.vue
│   │   └── [id].vue
│   ├── meetings/
│   │   ├── index.vue
│   │   ├── [id].vue
│   │   └── [id]/
│   │       ├── agenda.vue
│   │       └── minutes.vue
│   ├── messages/
│   │   ├── index.vue
│   │   └── [id].vue
│   ├── portal/
│   │   ├── profile.vue
│   │   ├── directory.vue
│   │   └── documents.vue
│   └── admin/
│       ├── residents.vue
│       ├── units.vue
│       ├── settings.vue
│       └── audit.vue
├── server/
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema (see section 15)
│   │   ├── index.ts             # DB connection (Supabase)
│   │   └── migrations/
│   ├── trpc/
│   │   ├── index.ts             # tRPC router root
│   │   ├── context.ts           # Request context (user, session)
│   │   └── routers/
│   │       ├── announcements.ts
│   │       ├── meetings.ts
│   │       ├── minutes.ts
│   │       ├── messages.ts
│   │       ├── residents.ts
│   │       ├── units.ts
│   │       ├── votes.ts
│   │       ├── facilities.ts
│   │       ├── documents.ts
│   │       └── ai.ts
│   └── api/
│       └── trpc/[trpc].ts       # tRPC HTTP handler
├── types/
│   └── index.ts                 # Shared TypeScript types
├── utils/
│   ├── permissions.ts           # Role/permission check helpers
│   ├── dates.ts                 # Date formatting helpers
│   └── segments.ts              # Segment filter evaluation
├── nuxt.config.ts
├── app.vue
└── package.json
```

---

## 13. Cursor Rules

Save this as `.cursor/rules` in the project root. Cursor reads this file automatically and applies these conventions to all generated code.

```
# Quorum — Cursor coding rules

## Project
- Name: Quorum
- Stack: Nuxt 3, Vue 3, TypeScript, tRPC, Drizzle ORM, PostgreSQL (Supabase), Radix Vue, Tiptap
- Styling: Scoped component CSS only. Never Tailwind. Never inline styles except for dynamic values.
- All CSS values must reference tokens from assets/tokens.css via var(--token-name).

## TypeScript
- Strict mode always on.
- No `any` types. Use `unknown` and narrow.
- Always type function return values explicitly.
- Prefer `type` over `interface` unless extending.
- Use Zod for all input validation on tRPC procedures.

## Vue components
- Composition API only. Never Options API.
- Always use `<script setup lang="ts">`.
- Props defined with `defineProps<{}>()` — typed, never untyped.
- Emits defined with `defineEmits<{}>()`.
- Keep components focused. If a component exceeds ~150 lines, split it.

## Component naming
- Base primitives: `Base` prefix — `BaseButton.vue`, `BaseInput.vue`, `BaseModal.vue`
- Layout singletons: `The` prefix — `TheSidebar.vue`, `TheNavbar.vue`
- Feature components: descriptive noun — `MeetingCard.vue`, `AnnouncementFeed.vue`
- Pages: lowercase with hyphens matching the route — `meeting-detail.vue`

## Composables
- `use` prefix always — `useAuth.ts`, `useToast.ts`
- Return reactive state and functions. Never return raw refs without wrapping.
- Side effects (API calls, subscriptions) go in composables, not components.

## tRPC routers
- One router file per domain (announcements, meetings, messages, etc.)
- All procedures use Zod input validation.
- Protect procedures with middleware: `publicProcedure`, `authedProcedure`, `boardProcedure`, `superAdminProcedure`.
- Never query the DB directly from a page or component. Always go through tRPC.

## Drizzle ORM
- Schema lives in server/db/schema.ts.
- Use snake_case for all column names.
- Always define relations explicitly.
- Never use raw SQL unless Drizzle cannot express the query.

## Permissions
- Never check roles inline in components with string comparisons.
- Always use helpers from utils/permissions.ts — `isBoard(user)`, `isSuperAdmin(user)`, `canEdit(user, resource)`.
- Board-only UI is hidden entirely (v-if), never just disabled.

## Styling
- Scoped styles in every component: `<style scoped>`.
- Use CSS custom properties from tokens.css for all colors, spacing, typography, and radii.
- No hardcoded hex values, pixel values, or font sizes outside the token file.
- Two font weights only: 400 (normal) and 500 (medium). Never 600 or 700.
- No box shadows except --shadow-focus on focus rings.
- No gradients except --gradient-brand and --gradient-brand-subtle, used only on logo mark and primary CTA button.
- No glassmorphism, blur, or transparency effects.

## Error handling
- All tRPC procedures wrapped in try/catch. Throw TRPCError with appropriate code.
- Client-side errors surfaced via useToast composable, never console.log only.
- Form validation errors shown inline under the relevant field.

## Accessibility
- All interactive elements must have visible focus styles using --shadow-focus.
- Minimum touch target 44×44px for all buttons and interactive elements.
- Radix Vue handles ARIA — do not add redundant aria-* attributes on Radix primitives.
- Images always have alt text. Decorative images use alt="".

## AI assist (server/trpc/routers/ai.ts)
- All Claude API calls go through the ai router. Never call the Anthropic API directly from the client.
- Always pass message type and recipient context in the system prompt.
- Always log ai_assisted, ai_mode, ai_tone, ai_input, ai_input_type to the relevant table.
- Use zero data retention headers on all Anthropic API calls.
```

---

## 14. API Endpoints (tRPC Routers)

All API calls go through tRPC. Procedures are protected by middleware based on role.

**Middleware levels:**
- `publicProcedure` — unauthenticated (invite landing, magic link)
- `authedProcedure` — any authenticated resident
- `boardProcedure` — board members and Super Admin only
- `superAdminProcedure` — Super Admin only

---

### announcements router
```ts
announcements.list()              // authed — paginated feed
announcements.getById(id)         // authed
announcements.create(input)       // board — title, body, priority, pinned, sendEmail
announcements.update(id, input)   // board — edit with history preserved
announcements.hide(id, reason)    // board — hide with required reason
announcements.pin(id)             // board
announcements.unpin(id)           // board
```

### meetings router
```ts
meetings.list()                   // authed — upcoming + past
meetings.getById(id)              // authed
meetings.create(input)            // board — title, type, date, time, location
meetings.update(id, input)        // board
meetings.cancel(id)               // board

meetings.agenda.get(meetingId)    // authed
meetings.agenda.save(meetingId, items)   // board — draft
meetings.agenda.publish(meetingId)       // board — notifies residents

meetings.minutes.get(meetingId)          // authed (published) / board (any status)
meetings.minutes.save(meetingId, body)   // board — autosave
meetings.minutes.finalize(meetingId)     // board — triggers review
meetings.minutes.approve(minutesId)      // board
meetings.minutes.requestChanges(minutesId, notes)  // board
meetings.minutes.publish(minutesId)      // board — locks + notifies
meetings.minutes.import(meetingId, file) // board — .docx import
```

### messages router
```ts
messages.threads.list()                  // authed — inbox
messages.threads.getById(id)             // authed — conversation
messages.send(input)                     // authed — to resident(s) or unit
messages.hide(id, reason)               // board
messages.markRead(threadId)             // authed
```

### votes router
```ts
votes.list()                            // authed — all votes with status
votes.getById(id)                       // authed
votes.getChain(parentId)               // authed — full re-run chain
votes.create(input)                     // board
votes.approve(id)                       // superAdmin — approve proposal
votes.cast(voteId, choice)             // authed — household ballot
votes.boardAccept(voteId, decision, notes)  // board — accept/reject result
votes.publish(voteId)                   // board — publish result
votes.rerun(voteId)                     // board — create child vote
```

### residents router
```ts
residents.me()                          // authed — current user profile
residents.update(input)                 // authed — own profile only
residents.list()                        // board — roster
residents.getById(id)                   // board
residents.invite(unitId, email)         // board — send unit invite
residents.inviteBulk(csv)              // superAdmin — CSV upload
residents.setRole(id, role, rank)       // superAdmin
residents.moveOut(householdId)          // board
```

### units router
```ts
units.list()                            // authed — directory
units.getById(id)                       // authed
units.update(id, input)                // board — unit details
units.getHistory(id)                    // board — occupancy history
```

### documents router
```ts
documents.list(category)               // authed
documents.getVersions(documentId)      // authed
documents.upload(input)                // board — file + category + changeNote
documents.delete(id)                   // board (soft delete / archive)
```

### facilities router (v2)
```ts
facilities.list()                       // authed
facilities.getById(id)                  // authed
facilities.create(input)               // board
facilities.update(id, input)           // board
facilities.archive(id)                 // board
facilities.bookings.list(facilityId)   // authed
facilities.bookings.create(input)      // authed
facilities.bookings.cancel(id)         // authed (own) / board (any)
facilities.maintenance.list()          // authed
facilities.maintenance.create(input)   // authed
facilities.maintenance.update(id, input) // board
```

### ai router
```ts
ai.assist(input)    // authed
                    // input: { mode, tone, content, messageType, recipientContext }
                    // returns: { suggestion: string }
                    // logs: ai_mode, ai_tone, ai_input, ai_input_type to source table
```

---

## 15. Drizzle Schema

```ts
// server/db/schema.ts
import { pgTable, uuid, varchar, text, boolean,
         integer, decimal, timestamp, date,
         pgEnum, jsonb, unique } from 'drizzle-orm/pg-core'
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
export const voteTypeEnum = pgEnum('vote_type', ['election', 'budget', 'bylaw', 'improvement'])
export const voteStatusEnum = pgEnum('vote_status', ['pending_approval', 'open', 'closed', 'failed', 'accepted', 'published'])
export const quorumFailureModeEnum = pgEnum('quorum_failure_mode', ['rerun', 'auto_extend', 'super_admin_override'])
export const ballotChoiceEnum = pgEnum('ballot_choice', ['yes', 'no', 'abstain'])
export const boardAcceptanceEnum = pgEnum('board_acceptance', ['accepted', 'not_accepted'])
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
  id:                     uuid('id').primaryKey().defaultRandom(),
  name:                   varchar('name', { length: 255 }).notNull(),
  address:                varchar('address', { length: 500 }),
  timezone:               varchar('timezone', { length: 100 }).notNull().default('America/Chicago'),
  maxSuperAdmins:         integer('max_super_admins').notNull().default(2),
  maxOccupantsPerUnit:    integer('max_occupants_per_unit').notNull().default(6),
  settings:               jsonb('settings').default({}),
  createdAt:              timestamp('created_at').notNull().defaultNow(),
})

export const unit = pgTable('unit', {
  id:           uuid('id').primaryKey().defaultRandom(),
  communityId:  uuid('community_id').notNull().references(() => community.id),
  unitNumber:   varchar('unit_number', { length: 50 }).notNull().unique(),
  unitType:     unitTypeEnum('unit_type').notNull(),
  building:     varchar('building', { length: 100 }),
  floor:        integer('floor'),
  notes:        text('notes'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export const household = pgTable('household', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  unitId:             uuid('unit_id').notNull().references(() => unit.id),
  primaryResidentId:  uuid('primary_resident_id'),
  status:             householdStatusEnum('status').notNull().default('active'),
  moveInDate:         date('move_in_date'),
  moveOutDate:        date('move_out_date'),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
})

export const resident = pgTable('resident', {
  id:               uuid('id').primaryKey().defaultRandom(),
  householdId:      uuid('household_id').notNull().references(() => household.id),
  email:            varchar('email', { length: 255 }).notNull().unique(),
  phone:            varchar('phone', { length: 50 }),
  firstName:        varchar('first_name', { length: 100 }).notNull(),
  lastName:         varchar('last_name', { length: 100 }).notNull(),
  residentType:     residentTypeEnum('resident_type').notNull(),
  directoryOptOut:  boolean('directory_opt_out').notNull().default(false),
  inviteStatus:     inviteStatusEnum('invite_status').notNull().default('pending'),
  inviteToken:      varchar('invite_token', { length: 255 }),
  inviteExpiresAt:  timestamp('invite_expires_at'),
  lastLoginAt:      timestamp('last_login_at'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

export const residentRole = pgTable('resident_role', {
  id:               uuid('id').primaryKey().defaultRandom(),
  residentId:       uuid('resident_id').notNull().references(() => resident.id),
  role:             roleEnum('role').notNull(),
  rank:             integer('rank'),               -- 1-4, board_member only
  title:            varchar('title', { length: 100 }),
  contextId:        uuid('context_id').notNull(),  -- community_id or committee_id
  contextType:      contextTypeEnum('context_type').notNull(),
  temporary:        boolean('temporary').notNull().default(false),
  temporaryReason:  varchar('temporary_reason', { length: 255 }),
  grantedBy:        uuid('granted_by').references(() => resident.id),
  grantedAt:        timestamp('granted_at').notNull().defaultNow(),
  revokedAt:        timestamp('revoked_at'),
})

// ─── Meetings ─────────────────────────────────────────────────────────────

export const meeting = pgTable('meeting', {
  id:           uuid('id').primaryKey().defaultRandom(),
  communityId:  uuid('community_id').notNull().references(() => community.id),
  title:        varchar('title', { length: 255 }).notNull(),
  meetingType:  varchar('meeting_type', { length: 100 }),
  location:     varchar('location', { length: 255 }),
  scheduledAt:  timestamp('scheduled_at').notNull(),
  status:       meetingStatusEnum('status').notNull().default('scheduled'),
  createdBy:    uuid('created_by').notNull().references(() => resident.id),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export const agenda = pgTable('agenda', {
  id:               uuid('id').primaryKey().defaultRandom(),
  meetingId:        uuid('meeting_id').notNull().references(() => meeting.id),
  status:           agendaStatusEnum('status').notNull().default('draft'),
  commentsEnabled:  boolean('comments_enabled').notNull().default(false),
  publishedAt:      timestamp('published_at'),
  items:            jsonb('items').notNull().default([]),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

export const agendaComment = pgTable('agenda_comment', {
  id:           uuid('id').primaryKey().defaultRandom(),
  agendaId:     uuid('agenda_id').notNull().references(() => agenda.id),
  residentId:   uuid('resident_id').notNull().references(() => resident.id),
  body:         text('body').notNull(),
  hidden:       boolean('hidden').notNull().default(false),
  hiddenReason: text('hidden_reason'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export const minutes = pgTable('minutes', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  meetingId:          uuid('meeting_id').notNull().references(() => meeting.id),
  status:             minutesStatusEnum('status').notNull().default('drafting'),
  body:               text('body'),
  importedDocUrl:     varchar('imported_doc_url', { length: 500 }),
  lastEditedBy:       uuid('last_edited_by').references(() => resident.id),
  lastEditedAt:       timestamp('last_edited_at'),
  finalizedAt:        timestamp('finalized_at'),
  publishedAt:        timestamp('published_at'),
  reminderSentAt:     timestamp('reminder_sent_at'),
  escalationSentAt:   timestamp('escalation_sent_at'),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
})

export const minutesApproval = pgTable('minutes_approval', {
  id:         uuid('id').primaryKey().defaultRandom(),
  minutesId:  uuid('minutes_id').notNull().references(() => minutes.id),
  residentId: uuid('resident_id').notNull().references(() => resident.id),
  decision:   minutesDecisionEnum('decision').notNull(),
  round:      integer('round').notNull().default(1),
  notes:      text('notes'),
  votedAt:    timestamp('voted_at').notNull().defaultNow(),
})

// ─── Voting ───────────────────────────────────────────────────────────────

export const vote = pgTable('vote', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  communityId:        uuid('community_id').notNull().references(() => community.id),
  parentVoteId:       uuid('parent_vote_id').references((): any => vote.id),
  runNumber:          integer('run_number').notNull().default(1),
  voteType:           voteTypeEnum('vote_type').notNull(),
  title:              varchar('title', { length: 255 }).notNull(),
  description:        text('description'),
  thresholdPct:       decimal('threshold_pct', { precision: 5, scale: 2 }).notNull(),
  quorumPct:          decimal('quorum_pct', { precision: 5, scale: 2 }).notNull(),
  quorumFailureMode:  quorumFailureModeEnum('quorum_failure_mode').notNull().default('rerun'),
  maxReruns:          integer('max_reruns').notNull().default(3),
  status:             voteStatusEnum('status').notNull().default('pending_approval'),
  opensAt:            timestamp('opens_at'),
  closesAt:           timestamp('closes_at'),
  createdBy:          uuid('created_by').notNull().references(() => resident.id),
  approvedBy:         uuid('approved_by').references(() => resident.id),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
})

export const ballot = pgTable('ballot', {
  id:           uuid('id').primaryKey().defaultRandom(),
  voteId:       uuid('vote_id').notNull().references(() => vote.id),
  householdId:  uuid('household_id').notNull().references(() => household.id),
  castBy:       uuid('cast_by').notNull().references(() => resident.id),
  choice:       ballotChoiceEnum('choice').notNull(),
  castAt:       timestamp('cast_at').notNull().defaultNow(),
}, (t) => ({
  uniqueHouseholdVote: unique().on(t.voteId, t.householdId),
}))

export const boardAcceptance = pgTable('board_acceptance', {
  id:         uuid('id').primaryKey().defaultRandom(),
  voteId:     uuid('vote_id').notNull().references(() => vote.id),
  residentId: uuid('resident_id').notNull().references(() => resident.id),
  decision:   boardAcceptanceEnum('decision').notNull(),
  notes:      text('notes'),
  votedAt:    timestamp('voted_at').notNull().defaultNow(),
})

// ─── Assets ───────────────────────────────────────────────────────────────

export const facility = pgTable('facility', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  communityId:          uuid('community_id').notNull().references(() => community.id),
  name:                 varchar('name', { length: 255 }).notNull(),
  description:          text('description'),
  capacity:             integer('capacity'),
  status:               facilityStatusEnum('status').notNull().default('open'),
  bookingRestrictions:  jsonb('booking_restrictions').default({}),
  hours:                jsonb('hours').default({}),
  archivedAt:           timestamp('archived_at'),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
})

export const booking = pgTable('booking', {
  id:           uuid('id').primaryKey().defaultRandom(),
  facilityId:   uuid('facility_id').notNull().references(() => facility.id),
  householdId:  uuid('household_id').notNull().references(() => household.id),
  bookedBy:     uuid('booked_by').notNull().references(() => resident.id),
  startsAt:     timestamp('starts_at').notNull(),
  endsAt:       timestamp('ends_at').notNull(),
  guestCount:   integer('guest_count'),
  notes:        text('notes'),
  status:       bookingStatusEnum('status').notNull().default('confirmed'),
  cancelledBy:  uuid('cancelled_by').references(() => resident.id),
  cancelReason: text('cancel_reason'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export const maintenanceRequest = pgTable('maintenance_request', {
  id:               uuid('id').primaryKey().defaultRandom(),
  facilityId:       uuid('facility_id').notNull().references(() => facility.id),
  submittedBy:      uuid('submitted_by').notNull().references(() => resident.id),
  assignedTo:       uuid('assigned_to').references(() => resident.id),
  title:            varchar('title', { length: 255 }).notNull(),
  description:      text('description'),
  photoUrls:        jsonb('photo_urls').default([]),
  priority:         maintenancePriorityEnum('priority').notNull().default('routine'),
  status:           maintenanceStatusEnum('status').notNull().default('open'),
  resolutionNotes:  text('resolution_notes'),
  resolvedAt:       timestamp('resolved_at'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

// ─── Sub-committees ───────────────────────────────────────────────────────

export const subCommittee = pgTable('sub_committee', {
  id:               uuid('id').primaryKey().defaultRandom(),
  communityId:      uuid('community_id').notNull().references(() => community.id),
  name:             varchar('name', { length: 255 }).notNull(),
  purpose:          text('purpose'),
  leadResidentId:   uuid('lead_resident_id').references(() => resident.id),
  membershipMode:   committeeModeEnum('membership_mode').notNull().default('manual'),
  status:           committeeStatusEnum('status').notNull().default('active'),
  archivedAt:       timestamp('archived_at'),
  createdBy:        uuid('created_by').notNull().references(() => resident.id),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

export const committeeMember = pgTable('committee_member', {
  id:             uuid('id').primaryKey().defaultRandom(),
  committeeId:    uuid('committee_id').notNull().references(() => subCommittee.id),
  residentId:     uuid('resident_id').notNull().references(() => resident.id),
  status:         committeeMemberStatusEnum('status').notNull().default('pending'),
  invitedBy:      uuid('invited_by').references(() => resident.id),
  joinedAt:       timestamp('joined_at'),
  removedAt:      timestamp('removed_at'),
  removalReason:  text('removal_reason'),
})

// ─── Platform infrastructure ──────────────────────────────────────────────

export const segment = pgTable('segment', {
  id:               uuid('id').primaryKey().defaultRandom(),
  communityId:      uuid('community_id').notNull().references(() => community.id),
  name:             varchar('name', { length: 255 }).notNull(),
  createdBy:        uuid('created_by').notNull().references(() => resident.id),
  filterCriteria:   jsonb('filter_criteria').notNull().default({}),
  lastEvaluatedAt:  timestamp('last_evaluated_at'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

export const notification = pgTable('notification', {
  id:         uuid('id').primaryKey().defaultRandom(),
  residentId: uuid('resident_id').notNull().references(() => resident.id),
  category:   notificationCategoryEnum('category').notNull(),
  channel:    notificationChannelEnum('channel').notNull(),
  subject:    varchar('subject', { length: 500 }),
  body:       text('body'),
  mandatory:  boolean('mandatory').notNull().default(false),
  status:     notificationStatusEnum('status').notNull().default('queued'),
  sentAt:     timestamp('sent_at'),
  readAt:     timestamp('read_at'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
})

export const auditLog = pgTable('audit_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  communityId:  uuid('community_id').notNull().references(() => community.id),
  actorId:      uuid('actor_id').references(() => resident.id),
  action:       varchar('action', { length: 255 }).notNull(),
  entityType:   varchar('entity_type', { length: 100 }).notNull(),
  entityId:     uuid('entity_id'),
  before:       jsonb('before'),
  after:        jsonb('after'),
  ipAddress:    varchar('ip_address', { length: 50 }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

// ─── Documents ────────────────────────────────────────────────────────────

export const document = pgTable('document', {
  id:           uuid('id').primaryKey().defaultRandom(),
  communityId:  uuid('community_id').notNull().references(() => community.id),
  name:         varchar('name', { length: 255 }).notNull(),
  category:     varchar('category', { length: 100 }).notNull(),
  fileUrl:      varchar('file_url', { length: 500 }).notNull(),
  fileSizeBytes: integer('file_size_bytes'),
  version:      integer('version').notNull().default(1),
  changeNote:   text('change_note'),
  parentId:     uuid('parent_id'),
  uploadedBy:   uuid('uploaded_by').notNull().references(() => resident.id),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

// ─── Announcements & Messages ─────────────────────────────────────────────

export const announcement = pgTable('announcement', {
  id:             uuid('id').primaryKey().defaultRandom(),
  communityId:    uuid('community_id').notNull().references(() => community.id),
  title:          varchar('title', { length: 255 }).notNull(),
  body:           text('body').notNull(),
  priority:       varchar('priority', { length: 20 }).notNull().default('general'),
  pinned:         boolean('pinned').notNull().default(false),
  hidden:         boolean('hidden').notNull().default(false),
  hiddenReason:   text('hidden_reason'),
  createdBy:      uuid('created_by').notNull().references(() => resident.id),
  aiAssisted:     boolean('ai_assisted').default(false),
  aiMode:         aiModeEnum('ai_mode'),
  aiTone:         aiToneEnum('ai_tone'),
  aiInput:        text('ai_input'),
  aiInputType:    aiInputTypeEnum('ai_input_type'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
})

export const message = pgTable('message', {
  id:           uuid('id').primaryKey().defaultRandom(),
  threadId:     uuid('thread_id').notNull(),
  senderId:     uuid('sender_id').notNull().references(() => resident.id),
  body:         text('body').notNull(),
  hidden:       boolean('hidden').notNull().default(false),
  hiddenReason: text('hidden_reason'),
  readAt:       timestamp('read_at'),
  aiAssisted:   boolean('ai_assisted').default(false),
  aiMode:       aiModeEnum('ai_mode'),
  aiTone:       aiToneEnum('ai_tone'),
  aiInput:      text('ai_input'),
  aiInputType:  aiInputTypeEnum('ai_input_type'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})
```

---

*End of document.*
