import { useNavigate } from 'react-router'
import { Button } from '~/components/ui/button'

interface EmptyStateAction {
  label: string
  to?: string
  onClick?: () => void
}

interface EmptyStateProps {
  emoji: string
  title: string
  description?: string
  actions?: EmptyStateAction[]
}

export function EmptyState({ emoji, title, description, actions }: EmptyStateProps) {
  const navigate = useNavigate()

  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border py-14"
      style={{ borderColor: 'var(--color-hairline)', background: 'var(--color-surface-card)' }}
    >
      <span className="mb-2 text-4xl">{emoji}</span>
      <p className="mb-4 text-sm" style={{ color: 'var(--color-muted)' }}>{title}</p>
      {description && (
        <p className="mb-4 text-xs" style={{ color: 'var(--color-muted-soft)' }}>{description}</p>
      )}
      {actions && actions.length > 0 && (
        <div className="flex gap-3">
          {actions.map(action => (
            <Button
              key={action.label}
              type="button"
              onClick={() => {
                if (action.onClick) {
                  action.onClick()
                }
                else if (action.to) {
                  navigate(action.to)
                }
              }}
              className="h-9 px-4 text-sm"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
