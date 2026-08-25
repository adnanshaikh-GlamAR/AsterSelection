export const assetCacheVersion = "2026-08-24-aster-selection-v5";

export function appendAssetVersion(url: string) {
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}v=${encodeURIComponent(assetCacheVersion)}`;
}
