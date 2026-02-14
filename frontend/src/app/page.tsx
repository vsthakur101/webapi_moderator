'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProxyStatus } from '@/components/ProxyStatus';
import { RequestList } from '@/components/RequestList';
import { RequestDetail } from '@/components/RequestDetail';
import { getRequests, getRequest, deleteRequest, replayRequest } from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import type { RequestListItem, Request } from '@/types';
import { Activity, Clock, Zap, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [realtimeRequests, setRealtimeRequests] = useState<RequestListItem[]>([]);

  const { data: requests = [], refetch } = useQuery({
    queryKey: ['requests', { limit: 50 }],
    queryFn: () => getRequests({ limit: 50 }),
  });

  const { data: selectedRequest } = useQuery({
    queryKey: ['request', selectedRequestId],
    queryFn: () => (selectedRequestId ? getRequest(selectedRequestId) : null),
    enabled: !!selectedRequestId,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === 'new_request') {
        setRealtimeRequests((prev) => [message.data as RequestListItem, ...prev].slice(0, 50));
      }
    });

    return unsubscribe;
  }, []);

  // Merge real-time and fetched requests
  const allRequests = [...realtimeRequests, ...requests].reduce((acc, req) => {
    if (!acc.find((r) => r.id === req.id)) {
      acc.push(req);
    }
    return acc;
  }, [] as RequestListItem[]);

  const handleSelectRequest = (request: RequestListItem) => {
    setSelectedRequestId(request.id);
  };

  const handleDeleteRequest = async () => {
    if (selectedRequestId) {
      await deleteRequest(selectedRequestId);
      setSelectedRequestId(null);
      refetch();
    }
  };

  const handleReplayRequest = async () => {
    if (selectedRequestId) {
      const result = await replayRequest({ request_id: selectedRequestId });
      console.log('Replay result:', result);
    }
  };

  // Calculate stats
  const totalRequests = allRequests.length;
  const avgDuration =
    allRequests.filter((r) => r.duration_ms).reduce((acc, r) => acc + (r.duration_ms || 0), 0) /
      Math.max(allRequests.filter((r) => r.duration_ms).length, 1) || 0;
  const interceptedCount = allRequests.filter((r) => r.intercepted).length;
  const errorCount = allRequests.filter((r) => r.response_status && r.response_status >= 400).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor and intercept API traffic in real-time</p>
      </header>

      {/* Proxy Status */}
      <div className="p-6 border-b border-border">
        <ProxyStatus />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 p-6 border-b border-border">
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <Activity className="w-8 h-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{totalRequests}</div>
              <div className="text-xs text-muted-foreground">Total Requests</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <Clock className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{avgDuration.toFixed(0)}ms</div>
              <div className="text-xs text-muted-foreground">Avg Duration</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <Zap className="w-8 h-8 text-yellow-500" />
            <div>
              <div className="text-2xl font-bold">{interceptedCount}</div>
              <div className="text-xs text-muted-foreground">Intercepted</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <div>
              <div className="text-2xl font-bold">{errorCount}</div>
              <div className="text-xs text-muted-foreground">Errors (4xx/5xx)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Request list */}
        <div className="w-1/2 border-r border-border overflow-auto">
          <div className="sticky top-0 bg-background/95 backdrop-blur p-4 border-b border-border">
            <h2 className="text-sm font-medium">Recent Requests</h2>
          </div>
          <RequestList
            requests={allRequests}
            selectedId={selectedRequestId || undefined}
            onSelect={handleSelectRequest}
          />
        </div>

        {/* Request detail */}
        <div className="w-1/2 overflow-auto">
          {selectedRequest ? (
            <RequestDetail
              request={selectedRequest}
              onReplay={handleReplayRequest}
              onDelete={handleDeleteRequest}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a request to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
