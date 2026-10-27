import type { ServerBuild } from 'react-router'
import { createRequestHandler } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line antfu/no-import-dist, antfu/no-import-node-modules-by-path -- 验证项目当前实际使用的框架默认 SSR 入口，避免测试自建渲染器。
import handleDocumentRequest from '../../node_modules/@react-router/dev/dist/config/defaults/entry.server.node'
import * as shell from '../components/layout/app-shell'
import * as root from '../root'
import * as assets from './assets._index'
import * as dashboard from './dashboard'
import * as plans from './plans._index'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAssetsWithCategoryName: vi.fn(),
  getCategoriesByUserId: vi.fn(),
  getTagsByUserId: vi.fn(),
  getAssetTagsByUserId: vi.fn(),
  getDashboardData: vi.fn(),
  getPlanSummariesByUserId: vi.fn(),
}))

vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient: () => ({
    supabase: { auth: { getUser: mocks.getUser } },
    headers: new Headers({ 'Set-Cookie': 'sb-session=refreshed; Path=/' }),
  }),
}))
vi.mock('~/db/queries/assets', () => mocks)
vi.mock('~/db/queries/dashboard', () => mocks)
vi.mock('~/db/queries/plans', () => mocks)

// 使用真实路由、框架请求处理器和框架默认 SSR 入口，只替换 Auth/DB 外部边界。
const routes: Record<string, NonNullable<ServerBuild['routes'][string]>> = {
  root: { id: 'root', path: '', module: root },
  shell: { id: 'shell', parentId: 'root', module: shell },
  assets: { id: 'assets', parentId: 'shell', path: 'assets', module: assets },
  dashboard: { id: 'dashboard', parentId: 'shell', path: 'dashboard', module: dashboard },
  plans: { id: 'plans', parentId: 'shell', path: 'plans', module: plans },
}
const build: ServerBuild = {
  entry: { module: { default: handleDocumentRequest as ServerBuild['entry']['module']['default'] } },
  routes,
  assets: {
    entry: { module: '/entry.js', imports: [] },
    routes: Object.fromEntries(Object.values(routes).map(route => [route.id, {
      id: route.id,
      parentId: route.parentId,
      path: route.path,
      module: `/${route.id}.js`,
      hasLoader: 'loader' in route.module,
      hasAction: false,
      hasClientLoader: false,
      hasClientAction: false,
      hasClientMiddleware: false,
      hasErrorBoundary: 'ErrorBoundary' in route.module,
      clientActionModule: undefined,
      clientLoaderModule: undefined,
      clientMiddlewareModule: undefined,
      hydrateFallbackModule: undefined,
    }])),
    url: '/manifest.js',
    version: 'test',
  },
  future: { v8_middleware: false, v8_passThroughRequests: false, unstable_trailingSlashAwareDataRequests: false },
  publicPath: '/',
  assetsBuildDirectory: 'build/client',
  ssr: true,
  isSpaMode: false,
  prerender: [],
  routeDiscovery: { mode: 'initial', manifestPath: '/__manifest' },
}
const handleRequest = createRequestHandler(build, 'test')

function request(path: string) {
  return new Request(`https://holdly.example${path}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, text: string) {
  const decoder = new TextDecoder()
  let html = ''
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    html += decoder.decode(chunk.value, { stream: true })
    if (html.includes(text))
      break
  }
  return html
}

describe('首屏流式 SSR', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } } })
    mocks.getAssetsWithCategoryName.mockResolvedValue([])
    mocks.getCategoriesByUserId.mockResolvedValue([])
    mocks.getTagsByUserId.mockResolvedValue([])
    mocks.getAssetTagsByUserId.mockResolvedValue([])
  })

  it.each([
    ['/assets', '资产管理', mocks.getAssetsWithCategoryName, [], '还没有资产，开始记录你的第一件物品'],
    ['/plans', '财务计划', mocks.getPlanSummariesByUserId, [], '还没有计划'],
    ['/dashboard', '统计总览', mocks.getDashboardData, {
      kpiByType: {
        one_time: { activeCount: 0, dailyCostTotal: 0, purchaseTotal: 0, yearlyCostTotal: 0 },
        subscription: { activeCount: 0, monthlyCostByCurrency: {}, yearlyCostByCurrency: {}, attentionCount: 0, attentionDetail: { overdue: 0, sevenDays: 0, thirtyDays: 0 } },
      },
      statsByType: {
        one_time: { categorySpending: [], monthlyTrend: [] },
        subscription: { categorySpending: [], monthlyTrend: [] },
      },
      expiring: [],
    }, '持有中买断'],
  ] as const)('%s 在查询完成前返回标题、导航和 loading', async (path, title, query, result, readyText) => {
    const pending = deferred<unknown>()
    query.mockReturnValue(pending.promise)
    // 若 loader 仍阻塞，超时后释放查询，确保失败测试也能回收响应流。
    const cleanup = setTimeout(() => pending.resolve(result), 1000)
    const started = performance.now()
    try {
      const response = await handleRequest(request(path))
      const reader = response.body!.getReader()
      const first = await readUntil(reader, '正在加载数据')
      expect(performance.now() - started).toBeLessThan(800)
      expect(response.status).toBe(200)
      expect(response.headers.get('Set-Cookie')).toContain('sb-session=refreshed')
      expect(first).toContain(title)
      expect(first).toContain('正在加载数据')
      expect(first).toContain('aria-current="page"')
      expect(first).not.toContain('startup-loading')
      expect(first).not.toContain(readyText)
      pending.resolve(result)
      let remainder = ''
      const decoder = new TextDecoder()
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read())
        remainder += decoder.decode(chunk.value, { stream: true })
      expect(remainder).toContain(readyText)
    }
    finally {
      clearTimeout(cleanup)
      pending.resolve(result)
    }
  })

  it('流式查询失败显示局部重试，保留页面标题', async () => {
    const pending = deferred<unknown>()
    mocks.getPlanSummariesByUserId.mockReturnValue(pending.promise)
    const response = await handleRequest(request('/plans'))
    const reader = response.body!.getReader()
    const first = await readUntil(reader, '正在加载数据')
    expect(first).toContain('财务计划')
    pending.reject(new Error('database unavailable'))
    let remainder = ''
    const decoder = new TextDecoder()
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read())
      remainder += decoder.decode(chunk.value, { stream: true })
    expect(remainder).toContain('数据加载失败，请重试')
    expect(remainder).toContain('重新加载')
    expect(remainder).not.toContain('还没有计划')
  })

  it.each(['/assets', '/dashboard', '/plans'])('%s 未登录时先重定向，不查询用户数据', async (path) => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const response = await handleRequest(request(path))
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toContain('/login')
    expect(mocks.getAssetsWithCategoryName).not.toHaveBeenCalled()
    expect(mocks.getDashboardData).not.toHaveBeenCalled()
    expect(mocks.getPlanSummariesByUserId).not.toHaveBeenCalled()
  })
})
