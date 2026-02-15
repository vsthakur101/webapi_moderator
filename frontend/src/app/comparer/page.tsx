'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { compareDiff, getRequests, getRequest } from '@/lib/api';
import type { DiffLine, DiffStats, RequestListItem, CompareSource } from '@/types';
import { GitCompare, Trash2, ArrowLeftRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type InputMode = 'text' | 'request';

export default function ComparerPage() {
  const [leftMode, setLeftMode] = useState<InputMode>('text');
  const [rightMode, setRightMode] = useState<InputMode>('text');
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const [leftRequestId, setLeftRequestId] = useState<string | null>(null);
  const [rightRequestId, setRightRequestId] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [stats, setStats] = useState<DiffStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [showRequestSelector, setShowRequestSelector] = useState<'left' | 'right' | null>(null);

  // Fetch requests for selector
  const { data: requests = [] } = useQuery({
    queryKey: ['requests', { limit: 100 }],
    queryFn: () => getRequests({ limit: 100 }),
  });

  const handleCompare = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const left: CompareSource =
        leftMode === 'text'
          ? { type: 'text', content: leftText }
          : { type: 'request', id: leftRequestId || undefined };

      const right: CompareSource =
        rightMode === 'text'
          ? { type: 'text', content: rightText }
          : { type: 'request', id: rightRequestId || undefined };

      const result = await compareDiff(left, right, {
        ignore_whitespace: ignoreWhitespace,
        ignore_case: ignoreCase,
      });

      if (result.success) {
        setDiff(result.diff);
        setStats(result.stats);
      } else {
        setError(result.error || 'Comparison failed');
        setDiff([]);
        setStats(null);
      }
    } catch (err) {
      setError('Failed to compare');
      setDiff([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRequest = (side: 'left' | 'right', requestId: string) => {
    if (side === 'left') {
      setLeftRequestId(requestId);
    } else {
      setRightRequestId(requestId);
    }
    setShowRequestSelector(null);
  };

  const handleSwap = () => {
    const tempMode = leftMode;
    const tempText = leftText;
    const tempRequestId = leftRequestId;

    setLeftMode(rightMode);
    setLeftText(rightText);
    setLeftRequestId(rightRequestId);

    setRightMode(tempMode);
    setRightText(tempText);
    setRightRequestId(tempRequestId);
  };

  const clearAll = () => {
    setLeftText('');
    setRightText('');
    setLeftRequestId(null);
    setRightRequestId(null);
    setDiff([]);
    setStats(null);
    setError(null);
  };

  const getLineClass = (type: string) => {
    switch (type) {
      case 'insert':
        return 'bg-green-500/20';
      case 'delete':
        return 'bg-red-500/20';
      case 'replace':
        return 'bg-yellow-500/20';
      default:
        return '';
    }
  };

  const selectedLeftRequest = requests.find((r) => r.id === leftRequestId);
  const selectedRightRequest = requests.find((r) => r.id === rightRequestId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold">Comparer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare two requests or text snippets side by side
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="space-y-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Input</CardTitle>
              <CardDescription>
                Select text or requests to compare
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Options */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ignoreWhitespace}
                    onCheckedChange={setIgnoreWhitespace}
                  />
                  <span className="text-sm">Ignore whitespace</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={ignoreCase} onCheckedChange={setIgnoreCase} />
                  <span className="text-sm">Ignore case</span>
                </div>
              </div>

              {/* Input Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Panel */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Left</span>
                      <div className="flex gap-1">
                        <Button
                          variant={leftMode === 'text' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setLeftMode('text')}
                        >
                          Text
                        </Button>
                        <Button
                          variant={leftMode === 'request' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setLeftMode('request')}
                        >
                          Request
                        </Button>
                      </div>
                    </div>
                  </div>

                  {leftMode === 'text' ? (
                    <textarea
                      className="w-full h-48 p-3 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter text to compare..."
                      value={leftText}
                      onChange={(e) => setLeftText(e.target.value)}
                    />
                  ) : (
                    <div
                      className="w-full h-48 p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors flex items-center justify-center"
                      onClick={() => setShowRequestSelector('left')}
                    >
                      {selectedLeftRequest ? (
                        <div className="text-center">
                          <div className="font-mono text-sm">
                            <span className={cn(
                              'font-bold mr-2',
                              selectedLeftRequest.method === 'GET' && 'text-green-500',
                              selectedLeftRequest.method === 'POST' && 'text-blue-500',
                              selectedLeftRequest.method === 'PUT' && 'text-yellow-500',
                              selectedLeftRequest.method === 'DELETE' && 'text-red-500'
                            )}>
                              {selectedLeftRequest.method}
                            </span>
                            {selectedLeftRequest.host}{selectedLeftRequest.path}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Click to change
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <FileText className="w-8 h-8 mx-auto mb-2" />
                          <div className="text-sm">Click to select a request</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Panel */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Right</span>
                      <div className="flex gap-1">
                        <Button
                          variant={rightMode === 'text' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRightMode('text')}
                        >
                          Text
                        </Button>
                        <Button
                          variant={rightMode === 'request' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRightMode('request')}
                        >
                          Request
                        </Button>
                      </div>
                    </div>
                  </div>

                  {rightMode === 'text' ? (
                    <textarea
                      className="w-full h-48 p-3 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter text to compare..."
                      value={rightText}
                      onChange={(e) => setRightText(e.target.value)}
                    />
                  ) : (
                    <div
                      className="w-full h-48 p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors flex items-center justify-center"
                      onClick={() => setShowRequestSelector('right')}
                    >
                      {selectedRightRequest ? (
                        <div className="text-center">
                          <div className="font-mono text-sm">
                            <span className={cn(
                              'font-bold mr-2',
                              selectedRightRequest.method === 'GET' && 'text-green-500',
                              selectedRightRequest.method === 'POST' && 'text-blue-500',
                              selectedRightRequest.method === 'PUT' && 'text-yellow-500',
                              selectedRightRequest.method === 'DELETE' && 'text-red-500'
                            )}>
                              {selectedRightRequest.method}
                            </span>
                            {selectedRightRequest.host}{selectedRightRequest.path}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Click to change
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <FileText className="w-8 h-8 mx-auto mb-2" />
                          <div className="text-sm">Click to select a request</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCompare} disabled={isLoading}>
                  <GitCompare className="w-4 h-4 mr-2" />
                  Compare
                </Button>
                <Button variant="outline" onClick={handleSwap}>
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Swap
                </Button>
                <Button variant="outline" onClick={clearAll}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-500">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          {stats && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Diff Results</CardTitle>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-500">
                      +{stats.additions} additions
                    </span>
                    <span className="text-red-500">
                      -{stats.deletions} deletions
                    </span>
                    <span className="text-muted-foreground">
                      {stats.unchanged} unchanged
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg overflow-auto max-h-[600px]">
                  <table className="w-full text-sm font-mono">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="w-12 px-2 py-2 text-left text-muted-foreground">#</th>
                        <th className="w-1/2 px-2 py-2 text-left">Left</th>
                        <th className="w-12 px-2 py-2 text-left text-muted-foreground">#</th>
                        <th className="w-1/2 px-2 py-2 text-left">Right</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.map((line, index) => (
                        <tr key={index} className={getLineClass(line.type)}>
                          <td className="px-2 py-1 text-muted-foreground text-right">
                            {line.left_line_num || ''}
                          </td>
                          <td className="px-2 py-1 whitespace-pre-wrap break-all">
                            {line.left_content !== null ? line.left_content : ''}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground text-right">
                            {line.right_line_num || ''}
                          </td>
                          <td className="px-2 py-1 whitespace-pre-wrap break-all">
                            {line.right_content !== null ? line.right_content : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {diff.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No differences found - contents are identical
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Request Selector Modal */}
          {showRequestSelector && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Select Request</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRequestSelector(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-auto max-h-[60vh]">
                  <div className="space-y-2">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className="p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() =>
                          handleSelectRequest(showRequestSelector, request.id)
                        }
                      >
                        <div className="font-mono text-sm">
                          <span className={cn(
                            'font-bold mr-2',
                            request.method === 'GET' && 'text-green-500',
                            request.method === 'POST' && 'text-blue-500',
                            request.method === 'PUT' && 'text-yellow-500',
                            request.method === 'DELETE' && 'text-red-500'
                          )}>
                            {request.method}
                          </span>
                          <span className="text-muted-foreground">{request.host}</span>
                          {request.path}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {request.response_status && (
                            <span className="mr-2">Status: {request.response_status}</span>
                          )}
                          {request.duration_ms && (
                            <span>{request.duration_ms}ms</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {requests.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        No requests captured yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
