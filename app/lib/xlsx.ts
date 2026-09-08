const MAX_WORKSHEET_NAME_LENGTH = 31
const INVALID_WORKSHEET_NAME_CHARACTERS = new Set(['[', ']', ':', '*', '?', '/', '\\'])

function sanitizeWorksheetName(name: string): string {
  return Array.from(name, character => (
    INVALID_WORKSHEET_NAME_CHARACTERS.has(character) ? '_' : character
  )).join('').trim() || '工作表'
}

function truncateWorksheetName(name: string, maxLength: number): string {
  let truncatedName = ''
  for (const character of name) {
    if (truncatedName.length + character.length > maxLength)
      break
    truncatedName += character
  }
  return truncatedName
}

export function allocateWorksheetName(name: string, usedNames: Set<string>): string {
  const baseName = sanitizeWorksheetName(name)
  const normalizedUsedNames = new Set(Array.from(usedNames, usedName => usedName.toLowerCase()))
  let candidate = truncateWorksheetName(baseName, MAX_WORKSHEET_NAME_LENGTH)
  let suffixNumber = 2

  while (normalizedUsedNames.has(candidate.toLowerCase())) {
    const suffix = `-${suffixNumber}`
    candidate = `${truncateWorksheetName(baseName, MAX_WORKSHEET_NAME_LENGTH - suffix.length)}${suffix}`
    suffixNumber += 1
  }

  usedNames.add(candidate)
  return candidate
}
