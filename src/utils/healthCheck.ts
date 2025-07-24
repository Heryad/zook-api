import { supabase } from '../config/supabase';
import os from 'os';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: string;
  timestamp: string;
  environment: string;
  memory: {
    total: string;
    free: string;
    used: string;
    usage: string;
  };
  database: {
    status: 'connected' | 'disconnected';
    latency: string;
  };
}

export class HealthCheck {
  static async getStatus(): Promise<HealthStatus> {
    const dbStart = Date.now();
    let dbStatus: HealthStatus['database'] = {
      status: 'disconnected',
      latency: '0ms'
    };

    try {
      // Test database connection
      await supabase.from('health_check').select('count').maybeSingle();
      dbStatus = {
        status: 'connected',
        latency: `${Date.now() - dbStart}ms`
      };
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Calculate memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory * 100).toFixed(2);

    // Format memory values to MB
    const formatMemory = (bytes: number): string => 
      `${Math.round(bytes / 1024 / 1024)} MB`;

    return {
      status: dbStatus.status === 'connected' ? 'healthy' : 'degraded',
      uptime: formatUptime(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      memory: {
        total: formatMemory(totalMemory),
        free: formatMemory(freeMemory),
        used: formatMemory(usedMemory),
        usage: `${memoryUsage}%`
      },
      database: dbStatus
    };
  }
}

function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
} 