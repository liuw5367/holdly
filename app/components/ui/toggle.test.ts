import { describe, expect, it } from 'vitest'
import { toggleVariants } from './toggle'

describe('toggle 主题选中态', () => {
  it('使用主题色而不是中性灰色表示选中', () => {
    const classes = toggleVariants()

    expect(classes).toContain('aria-pressed:bg-primary')
    expect(classes).toContain('aria-pressed:text-primary-foreground')
    expect(classes).toContain('aria-pressed:hover:bg-primary-active')
    expect(classes).not.toContain('aria-pressed:bg-muted')
    expect(classes).not.toContain('data-[state=on]:bg-muted')
  })
})
