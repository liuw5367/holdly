import process from 'node:process'
import { format } from 'date-fns'
import { eq } from 'drizzle-orm'
import { db } from '~/db'
import { profiles } from '~/db/schema'
import { generateBackupHtml } from '~/lib/backup.server'
import { sendEmail } from '~/lib/email.server'

export async function action({ request }: { request: Request }) {
  const secret = request.headers.get('x-cron-secret')
  const isCron = secret === process.env.CRON_SECRET || request.headers.get('x-cron-trigger') === 'true'

  if (!isCron) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const dayOfMonth = today.getDate()
  const todayStr = format(today, 'yyyy-MM-dd')

  const candidates = await db
    .select()
    .from(profiles)
    .where(eq(profiles.backupEnabled, true))

  let totalSent = 0
  let skippedNoEmail = 0
  let skippedDifferentDay = 0
  let skippedUnsupportedFrequency = 0
  let failed = 0

  for (const profile of candidates) {
    if (!profile.email) {
      skippedNoEmail++
      continue
    }

    if (profile.backupDayOfMonth !== dayOfMonth) {
      skippedDifferentDay++
      continue
    }

    if (profile.backupFrequency !== 'monthly') {
      skippedUnsupportedFrequency++
      continue
    }

    try {
      const html = await generateBackupHtml(profile.id)
      const delivery = await sendEmail({
        to: profile.email,
        subject: `Holdly 数据备份 - ${todayStr}`,
        html,
      })

      if (delivery.ok) {
        totalSent++
      }
      else {
        failed++
      }
    }
    catch (error) {
      failed++
      console.error('[backup-cron] failed to send backup:', error)
    }
  }

  return Response.json({
    ok: true,
    sent: totalSent,
    checked: candidates.length,
    skipped: {
      noEmail: skippedNoEmail,
      differentDay: skippedDifferentDay,
      unsupportedFrequency: skippedUnsupportedFrequency,
    },
    failed,
  })
}
