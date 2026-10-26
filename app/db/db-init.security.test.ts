import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('database initialization security', () => {
  it('为所有 public 业务表启用 RLS', () => {
    const sql = readFileSync(resolve(process.cwd(), 'docs/db-init.sql'), 'utf8')
    const tableNames = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)]
      .map(match => match[1])

    expect(tableNames).toHaveLength(19)
    for (const tableName of tableNames)
      expect(sql).toContain(`ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`)
  })
})
