export function formatExpiryCountdown(daysLeft: number): string {
  // 到期日当天使用自然语言，避免把“今天”表达成不自然的“0 天后”。
  return daysLeft === 0 ? '今天' : `${daysLeft} 天后`
}
