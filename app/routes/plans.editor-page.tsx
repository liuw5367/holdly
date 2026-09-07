import type { PlanEditorLoaderData } from './plans.shared'
import { IconCheck, IconPlus, IconTrash } from '@tabler/icons-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'
import { SubPageHeader } from '~/components/page-header'
import { PlanInvitePanel } from '~/components/plan-invite-panel'
import { PublicAvatar } from '~/components/public-avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { buildPlanAvatarToneMap } from '~/lib/plan-avatar'

interface PlanEditorActionData {
  error?: string
  inviteLink?: string | null
  inviteExpiresAt?: string | null
  importResult?: {
    insertedMonths: number
    skippedDuplicateMonths: number
    skippedExistingMonths: number
  }
}

interface PlanEditorPageProps {
  data: PlanEditorLoaderData
  actionData?: PlanEditorActionData
  isSaving: boolean
  isRegeneratingInvite: boolean
  isRevokingInvite: boolean
  isImportingHistory: boolean
  onSubmitSave: (payload: unknown) => void
  onRegenerateInvite: () => void
  onRevokeInvite: () => void
  onImportHistory: (file: File) => void
}

interface EditableMember {
  userId: string
  role: 'owner' | 'editor'
  note: string
  displayName: string
  avatarEmoji: string
}

interface EditableDefaultItem {
  id: string
  name: string
  itemType: 'income' | 'expense'
}

export function PlanEditorPage({
  data,
  actionData,
  isSaving,
  isRegeneratingInvite,
  isRevokingInvite,
  isImportingHistory,
  onSubmitSave,
  onRegenerateInvite,
  onRevokeInvite,
  onImportHistory,
}: PlanEditorPageProps) {
  const [emoji, setEmoji] = useState(data.emoji)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [name, setName] = useState(data.name)
  const [planMode, setPlanMode] = useState<'accumulate' | 'snapshot'>(data.planMode)
  const [permission, setPermission] = useState<'own' | 'all'>(data.permission)
  const [startingValue, setStartingValue] = useState(data.startingValue)
  const [members, setMembers] = useState<EditableMember[]>(data.members)
  const [defaultItems, setDefaultItems] = useState<EditableDefaultItem[]>(
    data.defaultItems.map(item => ({
      id: item.id,
      name: item.name,
      itemType: item.itemType,
    })),
  )
  const [newItemName, setNewItemName] = useState('')
  const [newItemType, setNewItemType] = useState<'income' | 'expense'>('income')
  const [historyFile, setHistoryFile] = useState<File | null>(null)
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  const inviteLink = actionData?.inviteLink ?? data.inviteLink
  const inviteExpiresAt = actionData?.inviteExpiresAt ?? data.inviteExpiresAt

  const canManageMembers = data.canManage
  const memberToneMap = useMemo(
    () => buildPlanAvatarToneMap(members.map(member => member.userId)),
    [members],
  )

  function updateMemberNote(userId: string, note: string) {
    setMembers(prev => prev.map(member => member.userId === userId ? { ...member, note } : member))
  }

  function removeMember(userId: string) {
    setMembers(prev => prev.filter(member => member.userId !== userId))
    setDeleteMemberId(null)
  }

  function removeDefaultItem(id: string) {
    setDefaultItems(prev => prev.filter(item => item.id !== id))
  }

  function addDefaultItem() {
    if (!newItemName.trim())
      return

    setDefaultItems(prev => [...prev, {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: newItemName.trim(),
      itemType: newItemType,
    }])
    setNewItemName('')
  }

  const payload = useMemo(() => {
    return {
      name,
      emoji,
      planMode,
      permission,
      startingValue,
      members: members.map(member => ({
        userId: member.userId,
        role: member.role,
        note: member.note,
      })),
      defaultItems: defaultItems.map((item, index) => ({
        id: item.id.startsWith('new-') ? undefined : item.id,
        name: item.name,
        itemType: item.itemType,
        sortOrder: index,
      })),
    }
  }, [name, emoji, planMode, permission, startingValue, members, defaultItems])

  return (
    <div className="pb-8">
      <SubPageHeader
        backTo={data.mode === 'create' ? '/plans' : `/plans/${data.planId}`}
        backLabel="返回"
        title={data.mode === 'create' ? '新建计划' : '编辑计划'}
        primaryAction={{
          label: isSaving ? '保存中...' : '保存',
          icon: IconCheck,
          pending: isSaving,
          onClick: () => onSubmitSave(payload),
        }}
      />

      <div className="mb-5 flex justify-center">
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger
            render={(
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="size-16 rounded-2xl border text-3xl transition-shadow hover:shadow-md"
                style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)' }}
              />
            )}
          >
            {emoji}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" side="bottom" align="center">
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                setEmoji(emojiData.emoji)
                setEmojiOpen(false)
              }}
              theme={resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT}
              lazyLoadEmojis
              skinTonesDisabled
              width={320}
              height={360}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          计划名称
        </label>
        <Input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-10"
        />
      </div>

      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            成员
          </label>
          {data.mode === 'edit' && data.canManage && (
            <PlanInvitePanel
              inviteLink={inviteLink}
              inviteExpiresAt={inviteExpiresAt}
              isRegenerating={isRegeneratingInvite}
              isRevoking={isRevokingInvite}
              onRegenerateInvite={onRegenerateInvite}
              onRevokeInvite={onRevokeInvite}
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          {members.map(member => (
            <div
              key={member.userId}
              className="rounded-lg border px-3 py-2.5"
              style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)' }}
            >
              <div className="mb-2 flex items-center gap-2.5">
                <PublicAvatar
                  emoji={member.avatarEmoji}
                  nickname={member.displayName}
                  size="md"
                  backgroundColor={memberToneMap.get(member.userId)?.backgroundColor}
                  textColor={memberToneMap.get(member.userId)?.textColor}
                />
                <span className="text-sm" style={{ color: 'var(--color-ink)' }}>
                  {member.displayName}
                </span>
                {canManageMembers && member.role !== 'owner' && (
                  <button
                    type="button"
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-primary)' }}
                    onClick={() => setDeleteMemberId(member.userId)}
                  >
                    移除
                  </button>
                )}
                <span className="ml-auto text-xs" style={{ color: 'var(--color-muted)' }}>
                  {member.role === 'owner' ? '所有者' : '编辑者'}
                </span>
              </div>
              <Input
                value={member.note}
                onChange={e => updateMemberNote(member.userId, e.target.value)}
                placeholder="成员备注（可选）"
                className="h-8 text-xs"
                disabled={!canManageMembers}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          记录模式
        </label>
        <Select value={planMode} onValueChange={v => setPlanMode((v || 'accumulate') as 'accumulate' | 'snapshot')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择模式">
              {(value) => {
                if (value === 'snapshot')
                  return '总额记录'
                return '收支累加'
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="accumulate">收支累加</SelectItem>
              <SelectItem value="snapshot">总额记录</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          协作权限
        </label>
        <Select value={permission} onValueChange={v => setPermission((v || 'own') as 'own' | 'all')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择权限">
              {(value) => {
                if (value === 'all')
                  return '成员可以编辑全部条目'
                return '成员只能编辑自己的条目'
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="own">成员只能编辑自己的条目</SelectItem>
              <SelectItem value="all">成员可以编辑全部条目</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          起始数字
        </label>
        <Input
          type="number"
          value={startingValue}
          onChange={e => setStartingValue(e.target.value)}
          className="h-10 font-[family-name:var(--font-mono)]"
        />
      </div>

      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          默认项目
        </label>
        <div className="flex flex-col gap-2">
          {defaultItems.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
              style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)' }}
            >
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: item.itemType === 'income' ? 'var(--color-success)' : 'var(--color-error)', color: '#fff', opacity: 0.85 }}>
                {item.itemType === 'income' ? '收入' : '支出'}
              </span>
              <span className="text-sm" style={{ color: 'var(--color-ink)' }}>{item.name}</span>
              <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" onClick={() => removeDefaultItem(item.id)}>
                <IconTrash size={14} />
              </Button>
            </div>
          ))}

          <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5" style={{ borderColor: 'var(--color-hairline)' }}>
            <Select value={newItemType} onValueChange={v => setNewItemType((v || 'income') as 'income' | 'expense')}>
              <SelectTrigger className="h-9 w-20">
                <SelectValue>{value => value === 'expense' ? '支出' : '收入'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="income">收入</SelectItem>
                  <SelectItem value="expense">支出</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Input
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder="项目名称"
              className="h-10 flex-1"
            />
            <Button type="button" variant="ghost" size="icon-sm" onClick={addDefaultItem}>
              <IconPlus size={16} />
            </Button>
          </div>
        </div>
      </div>

      {data.mode === 'edit' && data.canManage && (
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            导入历史（CSV）
          </label>
          <div className="rounded-lg border p-3" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)' }}>
            <div className="mb-2 text-xs" style={{ color: 'var(--color-muted)' }}>
              表头示例：记录日期、`邮箱|余额`、`邮箱|公积金`、备注。同月重复会自动忽略后续行。
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv,text/csv"
                className="h-10 flex-1"
                onChange={e => setHistoryFile(e.currentTarget.files?.[0] || null)}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10"
                disabled={!historyFile || isImportingHistory}
                onClick={() => historyFile && onImportHistory(historyFile)}
              >
                {isImportingHistory ? '导入中...' : '导入'}
              </Button>
            </div>
            {data.planMode !== 'snapshot' && (
              <div className="mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                当前计划是“收支累加”模式，历史导入仅支持“总额记录”模式。
              </div>
            )}
          </div>
        </div>
      )}

      {actionData?.importResult && (
        <div className="mb-2 text-sm" style={{ color: 'var(--color-success)' }}>
          导入完成：新增
          {actionData.importResult.insertedMonths}
          月，跳过同月重复
          {actionData.importResult.skippedDuplicateMonths}
          条，跳过已存在月份
          {actionData.importResult.skippedExistingMonths}
          条。
        </div>
      )}
      {actionData?.error && <div className="text-sm" style={{ color: 'var(--color-error)' }}>{actionData.error}</div>}

      <div
        className="py-3 md:hidden"
        style={{
          background: 'var(--color-canvas)',
          borderColor: 'var(--color-hairline)',
        }}
      >
        <Button
          type="button"
          className="h-11 w-full"
          onClick={() => onSubmitSave(payload)}
          disabled={isSaving}
        >
          <IconCheck size={16} />
          {isSaving ? '保存中...' : '保存计划'}
        </Button>
      </div>

      <AlertDialog open={!!deleteMemberId} onOpenChange={open => !open && setDeleteMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除成员</AlertDialogTitle>
            <AlertDialogDescription>
              移除后需点击保存才能生效。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="secondary">取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteMemberId && removeMember(deleteMemberId)}
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
