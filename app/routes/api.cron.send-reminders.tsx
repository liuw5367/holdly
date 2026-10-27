import process from 'node:process'
import { eq } from 'drizzle-orm'
import { db } from '~/db'
import { profiles } from '~/db/schema'
import { processUserReminders } from '~/lib/reminder.server'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function action({ request }: { request: Request }) {
  const secret = request.headers.get('x-cron-secret')
  const isCron = secret === process.env.CRON_SECRET || request.headers.get('x-cron-trigger') === 'true'

  if (!isCron) {
    const { supabase } = createSupabaseServerClient(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const sent = await processUserReminders(user.id)
    return Response.json({ ok: true, sent })
  }

  const allProfiles = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.reminderEnabled, true))

  let totalSent = 0
  for (const p of allProfiles) {
    totalSent += await processUserReminders(p.id)
  }

  return Response.json({ ok: true, sent: totalSent })
}
