export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message: string;
  data: T;
}

export type ApiResponseHandler<T> = {
  status: number;
  response: ApiResponse<T>;
} 