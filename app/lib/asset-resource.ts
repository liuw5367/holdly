export function belongsToAsset(
  resource: { assetId: string } | null | undefined,
  assetId: string,
) {
  return resource?.assetId === assetId
}
