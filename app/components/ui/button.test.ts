import { describe, expect, it } from 'vitest'
import { buttonVariants } from './button'

describe('button 基础规格', () => {
  it('只过渡交互相关属性并保持图标按钮尺寸基线', () => {
    const classes = buttonVariants({ size: 'sm' })
    const iconClasses = buttonVariants({ size: 'icon-xs' })

    expect(classes).toContain('transition-[color,background-color,border-color,box-shadow,opacity,transform]')
    expect(classes).not.toContain('transition-all')
    expect(classes).toContain('[&_svg:not([class*=\'size-\'])]:size-3.5')
    expect(iconClasses).toContain('[&_svg:not([class*=\'size-\'])]:size-3')
  })
})
