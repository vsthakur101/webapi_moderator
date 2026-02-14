'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { encodeBase64, decodeBase64 } from '@/lib/utils';
import type { InterceptedRequest } from '@/types';
import { Send, X, Play } from 'lucide-react';

interface RequestEditorProps {
  request: InterceptedRequest;
  onForward: () => void;
  onDrop: () => void;
  onForwardModified: (headers: Record<string, string>, body: string) => void;
}

export function RequestEditor({ request, onForward, onDrop, onForwardModified }: RequestEditorProps) {
  const [headers, setHeaders] = useState<[string, string][]>([]);
  const [body, setBody] = useState('');

  useEffect(() => {
    setHeaders(Object.entries(request.headers));
    setBody(request.body_b64 ? decodeBase64(request.body_b64) : '');
  }, [request]);

  const handleHeaderChange = (index: number, key: string, value: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = [key, value];
    setHeaders(newHeaders);
  };

  const addHeader = () => {
    setHeaders([...headers, ['', '']]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleForwardModified = () => {
    const headersObj = Object.fromEntries(headers.filter(([k]) => k.trim()));
    onForwardModified(headersObj, body);
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold text-yellow-500">INTERCEPTED</span>
          <span className="text-sm font-medium">{request.method}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDrop}>
            <X className="w-4 h-4 mr-1" />
            Drop
          </Button>
          <Button variant="outline" size="sm" onClick={onForward}>
            <Send className="w-4 h-4 mr-1" />
            Forward
          </Button>
          <Button size="sm" onClick={handleForwardModified}>
            <Play className="w-4 h-4 mr-1" />
            Forward Modified
          </Button>
        </div>
      </div>

      {/* URL */}
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <Input value={request.url} readOnly className="font-mono text-sm" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="headers" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-4 w-fit">
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
        </TabsList>

        <TabsContent value="headers" className="flex-1 overflow-auto p-4 m-0">
          <div className="space-y-2">
            {headers.map(([key, value], index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={key}
                  onChange={(e) => handleHeaderChange(index, e.target.value, value)}
                  placeholder="Header name"
                  className="font-mono text-sm flex-1"
                />
                <Input
                  value={value}
                  onChange={(e) => handleHeaderChange(index, key, e.target.value)}
                  placeholder="Value"
                  className="font-mono text-sm flex-[2]"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHeader(index)}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addHeader}>
              Add Header
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="body" className="flex-1 overflow-auto p-4 m-0">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full h-full min-h-[200px] p-3 font-mono text-sm bg-muted/50 rounded-md border border-border resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Request body..."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
