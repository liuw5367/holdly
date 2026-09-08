import process from 'node:process'

export function isAuthorizedCronRequest(request: Request) {
  const configuredSecret = process.env.CRON_SECRET
  const providedSecret = request.headers.get('x-cron-secret')

  return Boolean(configuredSecret && providedSecret && providedSecret === configuredSecret)
}
