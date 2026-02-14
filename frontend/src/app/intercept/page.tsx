'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RequestEditor } from '@/components/RequestEditor';
import { getProxyStatus, toggleIntercept, handleInterceptAction } from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import { encodeBase64 } from '@/lib/utils';
import type { InterceptedRequest, ProxyStatus } from '@/types';
import { Shield, ShieldOff, Zap } from 'lucide-react';

export default function InterceptPage() {
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [interceptedRequests, setInterceptedRequests] = useState<InterceptedRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<InterceptedRequest | null>(null);

  useEffect(() => {
    // Fetch initial status
    getProxyStatus().then(setProxyStatus);

    // Subscribe to intercept events
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === 'intercept') {
        const intercepted = message.data as InterceptedRequest;
        setInterceptedRequests((prev) => [...prev, intercepted]);
        if (!activeRequest) {
          setActiveRequest(intercepted);
        }
      } else if (message.type === 'proxy_status') {
        setProxyStatus(message.data as ProxyStatus);
      }
    });

    return unsubscribe;
  }, [activeRequest]);

  const handleToggleIntercept = async () => {
    const result = await toggleIntercept();
    setProxyStatus((prev) => (prev ? { ...prev, intercept_enabled: result.intercept_enabled } : null));
  };

  const handleForward = async () => {
    if (!activeRequest) return;

    await handleInterceptAction({
      request_id: activeRequest.id,
      action: 'forward',
    });

    removeActiveRequest();
  };

  const handleDrop = async () => {
    if (!activeRequest) return;

    await handleInterceptAction({
      request_id: activeRequest.id,
      action: 'drop',
    });

    removeActiveRequest();
  };

  const handleForwardModified = async (headers: Record<string, string>, body: string) => {
    if (!activeRequest) return;

    await handleInterceptAction({
      request_id: activeRequest.id,
      action: 'forward_modified',
      modified_headers: headers,
      modified_body_b64: encodeBase64(body),
    });

    removeActiveRequest();
  };

  const removeActiveRequest = () => {
    setInterceptedRequests((prev) => prev.filter((r) => r.id !== activeRequest?.id));
    const remaining = interceptedRequests.filter((r) => r.id !== activeRequest?.id);
    setActiveRequest(remaining[0] || null);
  };

  const isInterceptEnabled = proxyStatus?.intercept_enabled || false;
  const queueLength = interceptedRequests.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Intercept</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pause, inspect, and modify requests before they reach their destination
            </p>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="p-6 border-b border-border">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {isInterceptEnabled ? (
                    <Shield className="w-8 h-8 text-yellow-500" />
                  ) : (
                    <ShieldOff className="w-8 h-8 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium">
                      Intercept Mode: {isInterceptEnabled ? 'ON' : 'OFF'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isInterceptEnabled
                        ? 'Requests are being paused for inspection'
                        : 'Requests are passing through normally'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {queueLength > 0 && (
                  <Badge variant="warning" className="text-base px-3 py-1">
                    <Zap className="w-4 h-4 mr-1" />
                    {queueLength} in queue
                  </Badge>
                )}
                <Switch checked={isInterceptEnabled} onCheckedChange={handleToggleIntercept} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto">
        {activeRequest ? (
          <RequestEditor
            request={activeRequest}
            onForward={handleForward}
            onDrop={handleDrop}
            onForwardModified={handleForwardModified}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Shield className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">No intercepted requests</p>
            <p className="text-sm mt-2">
              {isInterceptEnabled
                ? 'Waiting for requests to intercept...'
                : 'Enable intercept mode to pause and inspect requests'}
            </p>
          </div>
        )}
      </div>

      {/* Queue indicator */}
      {queueLength > 1 && (
        <div className="p-4 border-t border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Queue:</span>
            <div className="flex gap-2 overflow-x-auto">
              {interceptedRequests.map((req) => (
                <Button
                  key={req.id}
                  variant={req.id === activeRequest?.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveRequest(req)}
                  className="text-xs"
                >
                  {req.method} {req.host}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
