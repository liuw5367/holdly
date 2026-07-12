import { describe, expect, it } from 'vitest'
import { escapeEmailHtml, renderEmailLayout, renderReminderEmail } from './email-template.server'

describe('email templates', () => {
  it('escapes dynamic email content', () => {
    expect(escapeEmailHtml('<script>"test" & more</script>'))
      .toBe('&lt;script&gt;&quot;test&quot; &amp; more&lt;/script&gt;')
  })

  it('renders branded reminder content', () => {
    const html = renderReminderEmail({
      title: '续费提醒',
      description: '「云服务」即将续费。',
      label: '续费日期',
      value: '2026-07-15',
      note: '请确认支付账户余额充足。',
    })

    expect(html).toContain('Holdly')
    expect(html).toContain('「云服务」即将续费。')
    expect(html).toContain('max-width:560px')
  })

  it('uses compact spacing for wide backup emails', () => {
    const html = renderEmailLayout({
      title: '数据备份',
      content: '<table></table>',
      headStyles: '.backup-table{font-size:11px}',
      variant: 'wide',
    })

    expect(html).toContain('max-width:1200px')
    expect(html).toContain('padding:16px 8px')
    expect(html).toContain('padding:20px 16px')
    expect(html).toContain('<style>.backup-table{font-size:11px}</style>')
  })
})
