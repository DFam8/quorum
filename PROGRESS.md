# Quorum — Build Progress

> Living document. Updated as features are built.
> For the full product spec see `hoa-platform-dev-doc.md`.

---

## What's built

### Auth & onboarding

Residents don't create passwords. The flow is:

1. Super Admin adds a unit and enters the resident's email.
2. The system generates an invite link and token, valid for 30 days.
3. The resident clicks the link, enters their email, and receives a magic link from Supabase.
4. After clicking the magic link they complete a short welcome flow — first name, last name, phone — and land on the dashboard.

The Super Admin is the first person in. They complete a community setup step (name, address, timezone) before any of the above is available.

Residents can also be bulk-imported from a CSV (unit number, type, email, name). The system upserts units, creates households, and generates invite tokens for each resident in one shot.

**Invite status** lives on the resident record: `pending` (link sent, not yet accepted) or `accepted` (onboarding complete).

---

### Units, households, and residents

The data model has three layers:

- **Unit** — the physical property. Permanent. Never deleted.
- **Household** — the current occupancy group on a unit. One primary contact per household.
- **Resident** — an individual person. Linked to a household.

A unit can be a condo, apartment, or single-family home (SFH). The UI adapts — SFHs show a street address and hide the building/floor fields. Condo and apartment units show building and floor.

Units are grouped by building on the admin page (Building A, Building B, Single Family Homes). Groups are collapsible. Each unit row shows the primary resident's name underneath.

**Deleting a unit** requires typing the unit's full address to confirm. All residents and households on that unit are cascade-deleted.

---

### Roles & permissions

Four levels, enforced server-side:

| Role | What they can do |
|------|-----------------|
| **Super Admin** | Everything. Only one active at a time. |
| **Board Member** | Post announcements, manage documents, manage units/residents. |
| **Owner** | Full resident access — portal, directory, documents, announcements. |
| **Renter** | Same as owner for now. Voting will differentiate (owners only). |

Board members have a rank (1–4) and an optional title (President, VP, Treasurer, etc.). Rank 1 is the Super Admin equivalent for board purposes.

Roles are granted by the Super Admin from the Residents admin page. A role can be revoked, which timestamps `revoked_at` — roles are never deleted.

Board-only UI elements are hidden entirely (not greyed out) from non-board residents.

---

### Admin — Units page

- Lists all units grouped by building with expand/collapse
- Add, edit, delete units
- Delete requires typing the unit name to confirm
- Bulk CSV import (3-step modal: upload → preview → results)
- Each unit shows the primary resident's name

---

### Admin — Residents page

- Lists all residents with unit, type, role, and invite status
- Super Admin can assign/revoke board roles
- Role assignment captures rank, title, and who granted it

---

### Admin — Dev tools page

For testing only. Two actions:

- **Seed test data** — creates 10 sample units (condos, apartments, SFHs), 12 residents (most already onboarded, a couple still pending), assigns 3 board roles, and posts 4 sample announcements.
- **Reset** — clears everything except the currently logged-in Super Admin's records. Requires typing "RESET".

---

### Announcements

Board members post announcements. Residents read them.

- **Priority** — General or Urgent. Urgent gets a red left border and badge.
- **Pinned** — pinned announcements float to the top of the feed regardless of date.
- **Edit** — board can edit any announcement. Each edit saves the previous version to an edit history. An "Edited" label appears on the post.
- **Hide** — board can hide a post with a required reason. The post is never deleted — residents see a placeholder: "This post was hidden by a moderator" with the reason shown.

**Unread tracking** uses a local timestamp stored in the browser. Any announcement posted after your last visit to the feed is considered unread and gets a "New" badge. The timestamp is stamped 1.5 seconds after you open the page (so you see the badges before they clear). The dashboard and sidebar reflect unread state from the same timestamp.

---

### Dashboard

The dashboard adapts to role:

- **Super Admin / Board** — sees a setup checklist (until units and residents exist), quick-access admin links, their unit card, and a recent announcements preview.
- **All residents** — sees a greeting, their unit card, and recent announcements.

The announcements section on the dashboard shows the 3 most recent non-hidden posts with unread dots and a "View all" link. An "X new" badge appears in the section header when there are unread items.

---

### Resident portal — Profile

Residents can edit their first name, last name, and phone. Email is read-only (tied to auth). A toggle lets them opt out of the resident directory, which hides their name and contact info from other residents (they appear as "Resident (opted out)").

---

### Resident portal — Directory

Lists all units. Each unit is expandable to show its residents. For each resident: name (or "opted out" placeholder), primary contact tag, board role badge, and phone (if not opted out). Searchable by name or unit.

---

### Resident portal — Documents

Documents are grouped by category (Governing Documents, Financials, Meeting Minutes, etc.). Each document shows who uploaded it and when. Documents uploaded in the last 14 days get a "New" badge.

Board members can upload new documents or new versions of existing ones. New versions increment a version number (v2, v3…). All versions are stored and accessible.

---

## Key decisions

**No passwords.** Magic link auth only. This is intentional — the target demographic (older residents) struggles with password management. One less thing to forget.

**Units are permanent.** Deleting a unit also deletes current residents, but the intent is that units represent physical properties that outlive any particular resident. Move-out workflow (marking a household inactive without deleting) is planned for v2.

**Content is hidden, never deleted.** Announcements and documents aren't hard-deleted — they're flagged as hidden with a reason. Transparency is a core principle of the platform.

**No buildings table.** Buildings are just a string field on units. Simple and sufficient for a single community. If multi-community ever becomes a requirement, revisit.

**Unread tracking in localStorage.** Per-announcement read state in the database would require a join table and adds complexity. A single "last viewed" timestamp per browser is good enough for announcements — it's not mission-critical like a message read receipt.

**Single-tenant.** One community per installation. No multi-tenancy. The `community_id` exists on every table for clean data isolation and to make a future multi-tenant migration possible, but the app assumes one community.

---

## What's next (v1 remaining)

### Communication
- [x] Direct messaging — resident ↔ board, board ↔ resident/unit, optional resident ↔ resident

### Meetings & minutes
- [x] Schedule meetings with title, type, location, date
- [x] Agenda — draft and publish, attach items
- [x] Minutes — autosave editor, board approval workflow, publish
- [x] Archive — past meetings in list, published minutes on detail page

### Direct messaging

Threads group messages between parties. Three thread types:
- **board** — resident initiates to the board (all board members can see and reply)
- **resident** — board initiates to a specific resident
- **unit** — board initiates to all residents on a specific unit

The UI is a two-panel split: thread list on the left, active conversation on the right. On mobile it stacks. Board members have a recipient picker when composing (board, resident, unit). Residents always send to the board.

Read receipts: `readAt` is stamped on messages when the recipient opens the thread. The sidebar shows a dot badge next to Messages when any thread has an unread message.

Residents can disable incoming DMs from other residents via an `allowDirectMessages` setting (the board can always message anyone). This setting defaults to on and can be toggled in the profile page (to be wired up).

### Social login
- [x] Google OAuth — residents can sign in with a Google account instead of magic link
- [ ] Facebook OAuth — deferred, set up later
- [ ] Apple Sign In — not planned
- [x] Link social provider to existing account on first use (match on email — Supabase handles this)
- [ ] Show connected providers in Profile so residents can add/remove them

### Polls
Board members create polls that residents vote on.

- [x] Poll schema — question, options, open/close dates, eligibility (owners only vs all), anonymous vs attributed
- [x] Poll creation UI — board-only form with option builder and scheduling
- [x] Active poll feed — residents see open polls, can cast one vote per poll
- [x] Vote recording — one response per resident, timestamped, respects eligibility rules
- [x] Poll close — manual close by board
- [x] Results / reporting — participation rate, per-option breakdown, eligible vs actual voter count
- [x] Poll history — archived closed polls with final results visible to all residents

### Still to wire up
- [x] Email notifications on new announcements (Resend)
- [x] Invite resend / reset from admin UI
- [x] Notification preferences — per-resident email toggles (announcements, meetings, messages) in profile page
- [x] Dashboard for non-board residents — non-board residents redirect to /feed

---

## Deferred to v2

- Voting (full lifecycle — creation, quorum, results, board acceptance)
- Community forum and moderation
- Broadcast + segments
- Facilities, bookings, maintenance requests
- Move-in / move-out workflow
- Violations (private to resident + board)
- Full audit log
