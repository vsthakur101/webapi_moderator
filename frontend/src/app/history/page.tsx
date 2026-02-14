'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequestList } from '@/components/RequestList';
import { RequestDetail } from '@/components/RequestDetail';
import { getRequests, getRequest, deleteRequest, clearRequests, replayRequest } from '@/lib/api';
import type { RequestListItem } from '@/types';
import { Search, Trash2, RefreshCw } from 'lucide-react';

export default function HistoryPage() {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<string>('');

  useEffect(() => {
    const handleClearSelection = () => setSelectedRequestId(null);
    window.addEventListener('app:clear-selection', handleClearSelection);
    return () => window.removeEventListener('app:clear-selection', handleClearSelection);
  }, []);

  const { data: requests = [], refetch, isLoading } = useQuery({
    queryKey: ['requests', { search, method, limit: 200 }],
    queryFn: () =>
      getRequests({
        search: search || undefined,
        method: method || undefined,
        limit: 200,
      }),
  });

  const { data: selectedRequest } = useQuery({
    queryKey: ['request', selectedRequestId],
    queryFn: () => (selectedRequestId ? getRequest(selectedRequestId) : null),
    enabled: !!selectedRequestId,
  });

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

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all request history?')) {
      await clearRequests();
      setSelectedRequestId(null);
      refetch();
    }
  };

  const handleReplayRequest = async () => {
    if (selectedRequestId) {
      const result = await replayRequest({ request_id: selectedRequestId });
      console.log('Replay result:', result);
      alert(`Replayed request - Status: ${result.status_code}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Request History</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse and search through captured requests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearAll}>
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="p-4 border-b border-border flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by URL, host, or path..."
            className="pl-9"
          />
        </div>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
        >
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Request list */}
        <div className="w-1/2 border-r border-border overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Loading...
            </div>
          ) : (
            <RequestList
              requests={requests}
              selectedId={selectedRequestId || undefined}
              onSelect={handleSelectRequest}
            />
          )}
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
