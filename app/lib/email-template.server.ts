interface EmailLayoutOptions {
  title: string
  content: string
  headStyles?: string
  preheader?: string
  variant?: 'default' | 'wide'
}

export function escapeEmailHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderEmailLayout({
  title,
  content,
  headStyles = '',
  preheader = title,
  variant = 'default',
}: EmailLayoutOptions): string {
  const wide = variant === 'wide'
  const maxWidth = wide ? 1200 : 560
  const outerPadding = wide ? '16px 8px' : '40px 16px'
  const contentPadding = wide ? '20px 16px' : '40px 32px'

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeEmailHtml(title)}</title>
  ${headStyles ? `<style>${headStyles}</style>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#f5f3ef;color:#292722;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeEmailHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f5f3ef;">
    <tr>
      <td align="center" style="padding:${outerPadding};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:${maxWidth}px;">
          <tr>
            <td align="center" style="padding-bottom:${wide ? 12 : 24}px;">
              <div style="font-size:${wide ? 30 : 36}px;line-height:44px;font-weight:700;color:#786b4f;">Holdly</div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;padding:${contentPadding};box-shadow:0 4px 20px rgba(41,39,34,0.06);">
              ${content}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:${wide ? 12 : 24}px 16px 0;">
              <p style="margin:0;font-size:12px;line-height:20px;color:#969087;">这是一封系统邮件，请勿直接回复。</p>
              <p style="margin:4px 0 0;font-size:12px;line-height:20px;color:#969087;">© ${new Date().getFullYear()} Holdly</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

interface ReminderEmailOptions {
  title: string
  description: string
  label: string
  value: string
  note: string
}

export function renderReminderEmail({ title, description, label, value, note }: ReminderEmailOptions): string {
  const content = `
<h1 style="margin:0 0 16px;font-size:24px;line-height:34px;font-weight:700;color:#292722;">${escapeEmailHtml(title)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#5f5b52;">${escapeEmailHtml(description)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f7f4ed;border-radius:12px;">
  <tr>
    <td style="padding:16px 18px;">
      <p style="margin:0 0 4px;font-size:12px;line-height:18px;color:#817c72;">${escapeEmailHtml(label)}</p>
      <p style="margin:0;font-size:18px;line-height:26px;font-weight:700;color:#786b4f;">${escapeEmailHtml(value)}</p>
    </td>
  </tr>
</table>
<div style="height:1px;margin-bottom:20px;background-color:#ebe8e1;"></div>
<p style="margin:0;font-size:13px;line-height:21px;color:#817c72;">${escapeEmailHtml(note)}</p>`

  return renderEmailLayout({ title, content, preheader: description })
}
