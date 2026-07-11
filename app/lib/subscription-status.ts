interface SubscriptionStatusInput {
  subscriptionStatus: string | null
  subscriptionStartDate: string | null
  purchaseDate: string | null
  subscriptionStoppedAt: string | null
}

export function isSubscriptionActive(subscription: SubscriptionStatusInput, today: string) {
  const startDate = subscription.subscriptionStartDate || subscription.purchaseDate
  if (!startDate || startDate > today)
    return false
  if (subscription.subscriptionStoppedAt)
    return subscription.subscriptionStoppedAt > today
  return subscription.subscriptionStatus !== 'cancelled' && subscription.subscriptionStatus !== 'expired'
}
