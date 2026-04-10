import { Resend } from 'resend'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'Quorum <noreply@quorum.community>'

// ── Announcement ──────────────────────────────────────────────────────────────

type AnnouncementEmailPayload = {
  communityName: string
  siteUrl: string
  announcement: {
    title: string
    body: string
    priority: string
    postedBy: string
  }
  recipients: Array<{ email: string; firstName: string }>
}

export async function sendAnnouncementEmails(payload: AnnouncementEmailPayload): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const { communityName, siteUrl, announcement, recipients } = payload
  const isUrgent = announcement.priority === 'urgent'
  const subject = isUrgent
    ? `[Urgent] ${announcement.title} — ${communityName}`
    : `${announcement.title} — ${communityName}`

  const bodyLines = announcement.body
    .split('\n')
    .map(l => l.trim() ? `<p style="margin:0 0 12px">${escapeHtml(l)}</p>` : '<br>')
    .join('')

  await Promise.allSettled(
    recipients.map(r =>
      resend.emails.send({
        from: FROM_ADDRESS,
        to: r.email,
        subject,
        html: announcementHtml({
          communityName,
          siteUrl,
          firstName: r.firstName,
          title: announcement.title,
          bodyHtml: bodyLines,
          postedBy: announcement.postedBy,
          isUrgent,
        }),
      })
    )
  )
}

// ── Invite ────────────────────────────────────────────────────────────────────

type InviteEmailPayload = {
  communityName: string
  inviteUrl: string
  recipient: { email: string; firstName: string }
}

export async function sendInviteEmail(payload: InviteEmailPayload): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const { communityName, inviteUrl, recipient } = payload

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: recipient.email,
    subject: `You've been invited to ${communityName} on Quorum`,
    html: inviteHtml({ communityName, inviteUrl, firstName: recipient.firstName }),
  })
}

// ── Templates ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function emailShell(content: string, communityName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(communityName)}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A2B4A">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
          <!-- Logo row -->
          <tr>
            <td style="padding-bottom:20px">
              <span style="font-size:13px;font-weight:500;color:#64748B">${escapeHtml(communityName)}</span>
              <span style="font-size:11px;color:#94A3B8;margin-left:6px">· Powered by Quorum</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;font-size:11px;color:#94A3B8;text-align:center;line-height:1.6">
              You're receiving this because you're a resident of ${escapeHtml(communityName)}.<br>
              Manage your notification preferences in your Quorum profile.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

type AnnouncementHtmlArgs = {
  communityName: string
  siteUrl: string
  firstName: string
  title: string
  bodyHtml: string
  postedBy: string
  isUrgent: boolean
}

function announcementHtml(args: AnnouncementHtmlArgs): string {
  const urgentBanner = args.isUrgent
    ? `<div style="background:#FEE2E2;border-bottom:1px solid #FECACA;padding:10px 28px;font-size:12px;font-weight:500;color:#991B1B">
        ⚠ Urgent announcement
      </div>`
    : ''

  const content = `
    ${urgentBanner}
    <div style="padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#64748B">Hi ${escapeHtml(args.firstName)},</p>
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:500;color:#1A2B4A;line-height:1.3">${escapeHtml(args.title)}</h1>
      <div style="font-size:14px;color:#334155;line-height:1.7">
        ${args.bodyHtml}
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#94A3B8">
        Posted by ${escapeHtml(args.postedBy)} · ${escapeHtml(args.communityName)}
      </p>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #F1F5F9;background:#F8FAFC">
      <a href="${args.siteUrl}/announcements"
         style="display:inline-block;padding:10px 20px;background:#4F7FFF;color:#FFFFFF;font-size:13px;font-weight:500;border-radius:8px;text-decoration:none">
        View in Quorum →
      </a>
    </div>`

  return emailShell(content, args.communityName)
}

type InviteHtmlArgs = {
  communityName: string
  inviteUrl: string
  firstName: string
}

function inviteHtml(args: InviteHtmlArgs): string {
  const content = `
    <div style="padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#64748B">Hi ${escapeHtml(args.firstName)},</p>
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:500;color:#1A2B4A;line-height:1.3">
        You've been invited to ${escapeHtml(args.communityName)}
      </h1>
      <p style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.7">
        Your community is using Quorum to manage announcements, meetings, documents, and more.
        Click the button below to accept your invitation and set up your account.
      </p>
      <p style="margin:0;font-size:12px;color:#94A3B8">This link expires in 30 days.</p>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #F1F5F9;background:#F8FAFC">
      <a href="${args.inviteUrl}"
         style="display:inline-block;padding:10px 20px;background:#4F7FFF;color:#FFFFFF;font-size:13px;font-weight:500;border-radius:8px;text-decoration:none">
        Accept invitation →
      </a>
    </div>`

  return emailShell(content, args.communityName)
}
