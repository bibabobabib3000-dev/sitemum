/**
 * Meta Pixel env helpers.
 *
 * Reads NEXT_PUBLIC_META_PIXEL_ID at build/runtime. When unset, every consumer
 * (PixelScript, sendCapiEvent, /api/capi/lead) is a silent no-op so the rest
 * of the app keeps working without Meta credentials.
 */

export function pixelId(): string | null {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  return id && id.length > 0 ? id : null;
}

export function isPixelConfigured(): boolean {
  return pixelId() !== null;
}

export function capiAccessToken(): string | null {
  const token = process.env.META_CAPI_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

export function pixelTestCode(): string | null {
  const code = process.env.META_PIXEL_TEST_CODE?.trim();
  return code && code.length > 0 ? code : null;
}

export function isCapiConfigured(): boolean {
  return pixelId() !== null && capiAccessToken() !== null;
}
