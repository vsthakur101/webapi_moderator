'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { getProxyStatus, startProxy, stopProxy, toggleIntercept } from '@/lib/api';
import type { ProxyStatus as ProxyStatusType } from '@/types';
import { Activity, Pause, Play, Shield, ShieldOff } from 'lucide-react';

export function ProxyStatus() {
  const [status, setStatus] = useState<ProxyStatusType | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await getProxyStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch proxy status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleProxy = async () => {
    setLoading(true);
    try {
      if (status?.state === 'running') {
        await stopProxy();
      } else {
        await startProxy();
      }
      await fetchStatus();
    } catch (err) {
      console.error('Failed to toggle proxy:', err);
    }
    setLoading(false);
  };

  const handleToggleIntercept = async () => {
    try {
      const result = await toggleIntercept();
      setStatus((prev) => (prev ? { ...prev, intercept_enabled: result.intercept_enabled } : null));
    } catch (err) {
      console.error('Failed to toggle intercept:', err);
    }
  };

  if (!status) {
    return (
      <Card className="bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const isRunning = status.state === 'running';

  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Status indicator */}
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
            <div>
              <div className="text-sm font-medium">
                Proxy {isRunning ? 'Running' : 'Stopped'}
              </div>
              <div className="text-xs text-muted-foreground">
                {status.host}:{status.port}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="font-mono text-lg">{status.requests_total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg text-yellow-500">{status.requests_intercepted}</div>
              <div className="text-xs text-muted-foreground">Intercepted</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {status.intercept_enabled ? (
                <Shield className="w-4 h-4 text-yellow-500" />
              ) : (
                <ShieldOff className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm">Intercept</span>
              <Switch
                checked={status.intercept_enabled}
                onCheckedChange={handleToggleIntercept}
                disabled={!isRunning}
              />
            </div>

            <Button
              variant={isRunning ? 'destructive' : 'default'}
              size="sm"
              onClick={handleToggleProxy}
              disabled={loading}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Start
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
