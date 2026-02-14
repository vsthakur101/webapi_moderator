'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { cn, getMethodColor, getStatusColor, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { RequestListItem } from '@/types';

interface RequestListProps {
  requests: RequestListItem[];
  selectedId?: string;
  onSelect: (request: RequestListItem) => void;
}

export function RequestList({ requests, selectedId, onSelect }: RequestListProps) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {requests.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          No requests captured yet
        </div>
      ) : (
        requests.map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            isSelected={request.id === selectedId}
            onClick={() => onSelect(request)}
          />
        ))
      )}
    </div>
  );
}

interface RequestRowProps {
  request: RequestListItem;
  isSelected: boolean;
  onClick: () => void;
}

function RequestRow({ request, isSelected, onClick }: RequestRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors',
        isSelected && 'bg-accent'
      )}
      onClick={onClick}
    >
      <div className="flex-shrink-0 w-16">
        <span className={cn('font-mono text-sm font-semibold', getMethodColor(request.method))}>
          {request.method}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{request.host}</span>
          {request.is_websocket && (
            <Badge variant="info" className="text-xs">
              WS
            </Badge>
          )}
          {request.intercepted && (
            <Badge variant="warning" className="text-xs">
              Intercepted
            </Badge>
          )}
          {request.modified && (
            <Badge variant="secondary" className="text-xs">
              Modified
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">{request.path}</div>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className={cn('text-sm font-mono', getStatusColor(request.response_status))}>
          {request.response_status || '-'}
        </div>
        <div className="text-xs text-muted-foreground">{formatDuration(request.duration_ms)}</div>
      </div>

      <div className="flex-shrink-0 w-24 text-right">
        <div className="text-xs text-muted-foreground">
          {format(new Date(request.timestamp), 'HH:mm:ss')}
        </div>
      </div>
    </div>
  );
}
