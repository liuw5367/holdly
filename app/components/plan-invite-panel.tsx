import { IconCheck, IconCopy, IconLoader2 } from '@tabler/icons-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'

interface PlanInvitePanelProps {
  inviteLink: string | null
  inviteExpiresAt: string | null
  isRegenerating: boolean
  isRevoking: boolean
  onRegenerateInvite: () => void
  onRevokeInvite: () => void
}

export function PlanInvitePanel({
  inviteLink,
  inviteExpiresAt,
  isRegenerating,
  isRevoking,
  onRegenerateInvite,
  onRevokeInvite,
}: PlanInvitePanelProps) {
  const [open, setOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')

  async function handleCopy() {
    if (!inviteLink)
      return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopyStatus('success')
      window.setTimeout(setCopyStatus, 1800, 'idle')
    }
    catch {
      setCopyStatus('error')
      window.setTimeout(setCopyStatus, 2200, 'idle')
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-auto px-0 py-0 text-sm font-medium"
        style={{ color: 'var(--color-primary)' }}
        onClick={() => setOpen(true)}
      >
        邀请成员
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>邀请成员</DialogTitle>
            <DialogDescription>
              通过邀请链接让成员加入计划。
            </DialogDescription>
          </DialogHeader>

          {inviteLink
            ? (
                <div className="space-y-3">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="h-9 text-xs"
                    onClick={e => e.currentTarget.select()}
                  />
                  <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    有效期至：
                    {inviteExpiresAt ? new Date(inviteExpiresAt).toLocaleString('zh-CN') : '--'}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" className="h-8" onClick={handleCopy}>
                      {copyStatus === 'success' ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      {copyStatus === 'success' ? '已复制' : copyStatus === 'error' ? '复制失败' : '复制链接'}
                    </Button>
                    <Button type="button" variant="destructive" className="h-8" onClick={onRevokeInvite} disabled={isRevoking}>
                      {isRevoking ? <IconLoader2 size={14} className="animate-spin" /> : null}
                      {isRevoking ? '吊销中...' : '吊销链接'}
                    </Button>
                    <Button type="button" variant="outline" className="h-8" onClick={onRegenerateInvite} disabled={isRegenerating}>
                      {isRegenerating ? <IconLoader2 size={14} className="animate-spin" /> : null}
                      {isRegenerating ? '生成中...' : '重新生成'}
                    </Button>
                  </DialogFooter>
                </div>
              )
            : (
                <DialogFooter>
                  <Button type="button" className="h-9" onClick={onRegenerateInvite} disabled={isRegenerating}>
                    {isRegenerating ? <IconLoader2 size={14} className="animate-spin" /> : null}
                    {isRegenerating ? '生成中...' : '生成邀请链接（30天有效）'}
                  </Button>
                </DialogFooter>
              )}
        </DialogContent>
      </Dialog>
    </>
  )
}
