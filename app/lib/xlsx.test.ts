import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { allocateWorksheetName } from './xlsx'

describe('allocateWorksheetName', () => {
  it('替换非法字符后可写入工作簿', () => {
    const workbook = XLSX.utils.book_new()
    const usedNames = new Set<string>()
    const worksheetName = allocateWorksheetName('计划-[]:*?/\\', usedNames)

    expect(() => XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['金额'], [0.3]]),
      worksheetName,
    )).not.toThrow()
    expect(workbook.SheetNames).toEqual([worksheetName])
  })

  it('为截断后重名的工作表分配不同名称', () => {
    const usedNames = new Set<string>()
    const sharedPrefix = `计划-${'相同前缀'.repeat(10)}`
    const firstName = allocateWorksheetName(`${sharedPrefix}-甲`, usedNames)
    const secondName = allocateWorksheetName(`${sharedPrefix}-乙`, usedNames)

    expect(firstName).toHaveLength(31)
    expect(secondName).toHaveLength(31)
    expect(secondName).not.toBe(firstName)
    expect(secondName).toMatch(/-2$/)
  })

  it('按 Excel 的大小写不敏感规则处理重名', () => {
    const usedNames = new Set(['Plan'])

    expect(allocateWorksheetName('plan', usedNames)).toBe('plan-2')
  })

  it('截断时保留完整的 Unicode 字符', () => {
    const workbook = XLSX.utils.book_new()
    const worksheetName = allocateWorksheetName(`${'a'.repeat(30)}😀`, new Set())

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[1]]), worksheetName)
    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const rereadWorkbook = XLSX.read(output)

    expect(worksheetName).toBe('a'.repeat(30))
    expect(rereadWorkbook.SheetNames).toEqual([worksheetName])
  })
})
