import { IconLoader2 } from '@tabler/icons-react'
import { useRevalidator } from 'react-router'
import { Button } from '~/components/ui/button'

export function PageLoading() {
  return (
    <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
      <IconLoader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      正在加载数据…
    </div>
  )
}

export function PageLoadError() {
  const revalidator = useRevalidator()
  const pending = revalidator.state === 'loading'

  return (
    <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <p>数据加载失败，请重试</p>
      <Button type="button" variant="outline" disabled={pending} onClick={() => void revalidator.revalidate()}>
        {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
        {pending ? '正在重试…' : '重新加载'}
      </Button>
    </div>
  )
}
