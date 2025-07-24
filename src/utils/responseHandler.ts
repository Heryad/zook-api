import { Response } from 'express';
import { ApiResponse } from '../types/api.types';

export class ResponseHandler {
  static success<T>(res: Response, status: number, message: string, data?: T): void {
    const response: ApiResponse<T> = {
      status: 'success',
      message,
      data: data || null as any
    };
    res.status(status).json(response);
  }

  static error(res: Response, status: number, message: string, errors?: any): void {
    const response: ApiResponse = {
      status: 'error',
      message,
      data: errors || null
    };
    res.status(status).json(response);
  }
} 