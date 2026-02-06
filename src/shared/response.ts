export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function successResponse<T>(data: T, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
    } as SuccessResponse<T>),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export function errorResponse(
  message: string,
  code: string,
  status: number = 400
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message,
        code,
      },
    } as ErrorResponse),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
