'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, decodeBase64, tryParseJson, formatJson, getMethodColor, getStatusColor } from '@/lib/utils';
import type { Request } from '@/types';
import { Play, Copy, Trash2 } from 'lucide-react';

interface RequestDetailProps {
  request: Request;
  onReplay?: () => void;
  onDelete?: () => void;
}

export function RequestDetail({ request, onReplay, onDelete }: RequestDetailProps) {
  const [activeTab, setActiveTab] = useState('request');

  const requestBody = request.request_body_b64 ? decodeBase64(request.request_body_b64) : null;
  const responseBody = request.response_body_b64 ? decodeBase64(request.response_body_b64) : null;

  const formattedRequestBody = requestBody ? tryParseJson(requestBody) : null;
  const formattedResponseBody = responseBody ? tryParseJson(responseBody) : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className={cn('font-mono text-lg font-bold', getMethodColor(request.method))}>
            {request.method}
          </span>
          <span className="text-sm font-medium">{request.host}</span>
          {request.response_status && (
            <Badge variant={request.response_status < 400 ? 'success' : 'destructive'}>
              {request.response_status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onReplay && (
            <Button variant="outline" size="sm" onClick={onReplay}>
              <Play className="w-4 h-4 mr-1" />
              Replay
            </Button>
          )}
          {onDelete && (
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* URL */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-sm font-mono break-all">{request.url}</span>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-6 w-6"
          onClick={() => copyToClipboard(request.url)}
        >
          <Copy className="w-3 h-3" />
        </Button>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground border-b border-border">
        <span>Time: {format(new Date(request.timestamp), 'yyyy-MM-dd HH:mm:ss')}</span>
        {request.duration_ms && <span>Duration: {request.duration_ms}ms</span>}
        {request.intercepted && <Badge variant="warning">Intercepted</Badge>}
        {request.modified && <Badge variant="secondary">Modified</Badge>}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-4 w-fit">
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="flex-1 overflow-auto p-4 m-0">
          <div className="space-y-4">
            <HeadersSection title="Request Headers" headers={request.request_headers || {}} />
            {requestBody && (
              <BodySection
                title="Request Body"
                body={requestBody}
                formatted={formattedRequestBody}
                contentType={request.request_content_type}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="response" className="flex-1 overflow-auto p-4 m-0">
          <div className="space-y-4">
            {request.response_status && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <span className={cn('font-mono', getStatusColor(request.response_status))}>
                  {request.response_status}
                </span>
              </div>
            )}
            <HeadersSection title="Response Headers" headers={request.response_headers || {}} />
            {responseBody && (
              <BodySection
                title="Response Body"
                body={responseBody}
                formatted={formattedResponseBody}
                contentType={request.response_content_type}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface HeadersSectionProps {
  title: string;
  headers: Record<string, string>;
}

function HeadersSection({ title, headers }: HeadersSectionProps) {
  const entries = Object.entries(headers);

  if (entries.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">No headers</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <div className="bg-muted/50 rounded-md p-3 font-mono text-xs space-y-1 max-h-64 overflow-auto">
        {entries.map(([key, value]) => (
          <div key={key} className="flex">
            <span className="text-blue-400 font-medium min-w-0">{key}:</span>
            <span className="ml-2 text-foreground break-all">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BodySectionProps {
  title: string;
  body: string;
  formatted: object | null;
  contentType?: string | null;
}

function BodySection({ title, body, formatted, contentType }: BodySectionProps) {
  const [showFormatted, setShowFormatted] = useState(true);
  const isJson = contentType?.includes('json') || formatted !== null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {isJson && formatted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFormatted(!showFormatted)}
            className="text-xs"
          >
            {showFormatted ? 'Raw' : 'Formatted'}
          </Button>
        )}
      </div>
      <pre className="bg-muted/50 rounded-md p-3 font-mono text-xs overflow-auto max-h-96 whitespace-pre-wrap break-all">
        {showFormatted && formatted ? formatJson(formatted) : body}
      </pre>
    </div>
  );
}
