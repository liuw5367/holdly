import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Filter } from './subscriptions._index'

describe('订阅筛选器', () => {
  it('在触发器中显示选中项名称而不是 key', () => {
    const html = renderToStaticMarkup(
      <Filter
        value="active"
        onChange={vi.fn()}
        options={[
          ['all', '全部状态'],
          ['active', '活动中'],
        ]}
      />,
    )

    expect(html).toContain('>活动中<')
    expect(html).not.toContain('>active<')
  })
})
