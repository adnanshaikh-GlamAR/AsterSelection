export const assetCacheVersion = "2026-08-25-aster-selection-v6";

export function appendAssetVersion(url: string) {
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}v=${encodeURIComponent(assetCacheVersion)}`;
}
