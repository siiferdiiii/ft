import { NextResponse } from "next/server";
import { ApiResponse } from "./types";

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status = 400
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}
