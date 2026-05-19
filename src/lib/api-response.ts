import { NextResponse } from "next/server";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiOk<T>>({ ok: true, data }, init);
}

export function jsonErr(
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  return NextResponse.json<ApiErr>(
    { ok: false, error: { code, message, details } },
    { status }
  );
}
