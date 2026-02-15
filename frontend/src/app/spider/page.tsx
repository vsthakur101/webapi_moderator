'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  Plus,
  Trash2,
  Play,
  Pause,
  Square,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  Link as LinkIcon,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  getSpiderSessions,
  createSpiderSession,
  getSpiderSession,
  deleteSpiderSession,
  startSpiderSession,
  pauseSpiderSession,
  resumeSpiderSession,
  stopSpiderSession,
} from '@/lib/api';
import type { SpiderSession, SpiderSessionCreate, SpiderSessionDetail, SpiderURL } from '@/types';
import { useWebSocket } from '@/lib/websocket';

export default function SpiderPage() {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSession, setNewSession] = useState<SpiderSessionCreate>({
    name: '',
    start_urls: [],
    max_depth: 3,
    max_pages: 100,
    threads: 5,
    delay_ms: 100,
    include_patterns: [],
    exclude_patterns: [],
    respect_robots_txt: true,
    follow_external_links: false,
  });
  const [startUrlsText, setStartUrlsText] = useState('');
  const [includeText, setIncludeText] = useState('');
  const [excludeText, setExcludeText] = useState('');
  const [urlFilter, setUrlFilter] = useState<string>('all');

  // WebSocket for real-time updates
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type === 'spider_progress' || message.type === 'spider_url') {
        queryClient.invalidateQueries({ queryKey: ['spiderSessions'] });
        if (selectedSessionId) {
          queryClient.invalidateQueries({ queryKey: ['spiderSession', selectedSessionId] });
        }
      }
    });

    return unsubscribe;
  }, [subscribe, queryClient, selectedSessionId]);

  // Queries
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['spiderSessions'],
    queryFn: getSpiderSessions,
    refetchInterval: 3000,
  });

  const { data: selectedSession, isLoading: loadingSession } = useQuery({
    queryKey: ['spiderSession', selectedSessionId],
    queryFn: () => (selectedSessionId ? getSpiderSession(selectedSessionId) : null),
    enabled: !!selectedSessionId,
    refetchInterval: selectedSessionId ? 2000 : false,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createSpiderSession,
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['spiderSessions'] });
      setSelectedSessionId(session.id);
      setShowNewForm(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSpiderSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiderSessions'] });
      if (selectedSessionId) {
        setSelectedSessionId(null);
      }
    },
  });

  const startMutation = useMutation({
    mutationFn: startSpiderSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiderSessions'] });
      queryClient.invalidateQueries({ queryKey: ['spiderSession', selectedSessionId] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: pauseSpiderSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiderSessions'] });
      queryClient.invalidateQueries({ queryKey: ['spiderSession', selectedSessionId] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: resumeSpiderSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiderSessions'] });
      queryClient.invalidateQueries({ queryKey: ['spiderSession', selectedSessionId] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopSpiderSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiderSessions'] });
      queryClient.invalidateQueries({ queryKey: ['spiderSession', selectedSessionId] });
    },
  });

  const resetForm = () => {
    setNewSession({
      name: '',
      start_urls: [],
      max_depth: 3,
      max_pages: 100,
      threads: 5,
      delay_ms: 100,
      include_patterns: [],
      exclude_patterns: [],
      respect_robots_txt: true,
      follow_external_links: false,
    });
    setStartUrlsText('');
    setIncludeText('');
    setExcludeText('');
  };

  const handleCreate = () => {
    const urls = startUrlsText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u);
    const includes = includeText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p);
    const excludes = excludeText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p);

    if (!newSession.name || urls.length === 0) {
      return;
    }

    createMutation.mutate({
      ...newSession,
      start_urls: urls,
      include_patterns: includes,
      exclude_patterns: excludes,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getURLStatusColor = (status: string) => {
    switch (status) {
      case 'crawled':
        return 'text-green-400';
      case 'crawling':
        return 'text-blue-400';
      case 'error':
        return 'text-red-400';
      case 'skipped':
        return 'text-yellow-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const filteredUrls = selectedSession?.discovered_urls?.filter((url) => {
    if (urlFilter === 'all') return true;
    return url.status === urlFilter;
  }) || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            <h1 className="text-xl font-semibold">Spider</h1>
          </div>
          <Button onClick={() => setShowNewForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sessions List */}
        <div className="w-80 border-r border-border overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Sessions ({sessions.length})
            </h2>

            {loadingSessions ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sessions yet</div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      setSelectedSessionId(session.id);
                      setShowNewForm(false);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSessionId === session.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate">{session.name}</span>
                      {getStatusIcon(session.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session.pages_crawled} / {session.max_pages} pages
                    </div>
                    {session.status === 'running' && (
                      <div className="mt-2">
                        <div className="h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${(session.pages_crawled / session.max_pages) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {showNewForm ? (
            <div className="p-6 max-w-2xl">
              <h2 className="text-lg font-semibold mb-6">New Spider Session</h2>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="name">Session Name</Label>
                  <Input
                    id="name"
                    value={newSession.name}
                    onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                    placeholder="e.g., example.com crawl"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="start_urls">Start URLs (one per line)</Label>
                  <Textarea
                    id="start_urls"
                    value={startUrlsText}
                    onChange={(e) => setStartUrlsText(e.target.value)}
                    placeholder="https://example.com/"
                    rows={3}
                    className="mt-1 font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max_depth">Max Depth</Label>
                    <Input
                      id="max_depth"
                      type="number"
                      min={1}
                      max={10}
                      value={newSession.max_depth}
                      onChange={(e) =>
                        setNewSession({ ...newSession, max_depth: parseInt(e.target.value) })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_pages">Max Pages</Label>
                    <Input
                      id="max_pages"
                      type="number"
                      min={1}
                      max={10000}
                      value={newSession.max_pages}
                      onChange={(e) =>
                        setNewSession({ ...newSession, max_pages: parseInt(e.target.value) })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="threads">Threads</Label>
                    <Input
                      id="threads"
                      type="number"
                      min={1}
                      max={20}
                      value={newSession.threads}
                      onChange={(e) =>
                        setNewSession({ ...newSession, threads: parseInt(e.target.value) })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="delay_ms">Delay (ms)</Label>
                    <Input
                      id="delay_ms"
                      type="number"
                      min={0}
                      max={5000}
                      value={newSession.delay_ms}
                      onChange={(e) =>
                        setNewSession({ ...newSession, delay_ms: parseInt(e.target.value) })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="include">Include Patterns (regex, one per line)</Label>
                  <Textarea
                    id="include"
                    value={includeText}
                    onChange={(e) => setIncludeText(e.target.value)}
                    placeholder=".*\.html$"
                    rows={2}
                    className="mt-1 font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="exclude">Exclude Patterns (regex, one per line)</Label>
                  <Textarea
                    id="exclude"
                    value={excludeText}
                    onChange={(e) => setExcludeText(e.target.value)}
                    placeholder=".*\.(css|js|png|jpg)$"
                    rows={2}
                    className="mt-1 font-mono text-sm"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="robots"
                      checked={newSession.respect_robots_txt}
                      onCheckedChange={(checked) =>
                        setNewSession({ ...newSession, respect_robots_txt: !!checked })
                      }
                    />
                    <Label htmlFor="robots" className="text-sm cursor-pointer">
                      Respect robots.txt
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="external"
                      checked={newSession.follow_external_links}
                      onCheckedChange={(checked) =>
                        setNewSession({ ...newSession, follow_external_links: !!checked })
                      }
                    />
                    <Label htmlFor="external" className="text-sm cursor-pointer">
                      Follow external links
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    Create Session
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewForm(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : selectedSession ? (
            <div className="p-6">
              {/* Session Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">{selectedSession.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {getStatusIcon(selectedSession.status)}
                    <span className="capitalize">{selectedSession.status}</span>
                    <span>-</span>
                    <span>
                      {selectedSession.pages_crawled} crawled, {selectedSession.pages_queued} queued
                    </span>
                    {selectedSession.error_count > 0 && (
                      <>
                        <span>-</span>
                        <span className="text-red-400">{selectedSession.error_count} errors</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {selectedSession.status === 'configured' && (
                    <Button
                      onClick={() => startMutation.mutate(selectedSession.id)}
                      disabled={startMutation.isPending}
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                  )}
                  {selectedSession.status === 'running' && (
                    <>
                      <Button
                        onClick={() => pauseMutation.mutate(selectedSession.id)}
                        disabled={pauseMutation.isPending}
                        variant="outline"
                        size="sm"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </Button>
                      <Button
                        onClick={() => stopMutation.mutate(selectedSession.id)}
                        disabled={stopMutation.isPending}
                        variant="destructive"
                        size="sm"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        Stop
                      </Button>
                    </>
                  )}
                  {selectedSession.status === 'paused' && (
                    <>
                      <Button
                        onClick={() => resumeMutation.mutate(selectedSession.id)}
                        disabled={resumeMutation.isPending}
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                      <Button
                        onClick={() => stopMutation.mutate(selectedSession.id)}
                        disabled={stopMutation.isPending}
                        variant="destructive"
                        size="sm"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        Stop
                      </Button>
                    </>
                  )}
                  {(selectedSession.status === 'completed' ||
                    selectedSession.status === 'error') && (
                    <Button
                      onClick={() => deleteMutation.mutate(selectedSession.id)}
                      disabled={deleteMutation.isPending}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {selectedSession.status === 'running' && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>
                      {Math.round((selectedSession.pages_crawled / selectedSession.max_pages) * 100)}
                      %
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(selectedSession.pages_crawled / selectedSession.max_pages) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {selectedSession.error_message && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-sm mt-1">{selectedSession.error_message}</p>
                </div>
              )}

              {/* URL Filter */}
              <div className="flex items-center gap-2 mb-4">
                <Label className="text-sm">Filter:</Label>
                <div className="flex gap-1">
                  {['all', 'crawled', 'queued', 'error', 'skipped'].map((status) => (
                    <Button
                      key={status}
                      variant={urlFilter === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUrlFilter(status)}
                      className="capitalize"
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Discovered URLs */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-secondary/30 px-4 py-2 border-b border-border">
                  <h3 className="text-sm font-medium">
                    Discovered URLs ({filteredUrls.length})
                  </h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {filteredUrls.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No URLs discovered yet
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/20 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">URL</th>
                          <th className="text-left px-4 py-2 font-medium w-20">Status</th>
                          <th className="text-left px-4 py-2 font-medium w-16">Depth</th>
                          <th className="text-left px-4 py-2 font-medium w-20">Code</th>
                          <th className="text-left px-4 py-2 font-medium w-20">Links</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredUrls.map((url) => (
                          <tr key={url.id} className="hover:bg-secondary/20">
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <a
                                  href={url.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:underline truncate max-w-md"
                                  title={url.url}
                                >
                                  {url.url}
                                </a>
                                <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              </div>
                              {url.title && (
                                <div className="text-xs text-muted-foreground truncate mt-0.5">
                                  {url.title}
                                </div>
                              )}
                            </td>
                            <td className={`px-4 py-2 capitalize ${getURLStatusColor(url.status)}`}>
                              {url.status}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{url.depth}</td>
                            <td className="px-4 py-2">
                              {url.response_status && (
                                <span
                                  className={
                                    url.response_status >= 200 && url.response_status < 300
                                      ? 'text-green-400'
                                      : url.response_status >= 400
                                        ? 'text-red-400'
                                        : 'text-yellow-400'
                                  }
                                >
                                  {url.response_status}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <LinkIcon className="w-3 h-3" />
                                {url.links_found}
                                {url.forms_found > 0 && (
                                  <>
                                    <FileText className="w-3 h-3 ml-2" />
                                    {url.forms_found}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Session Config */}
              <div className="mt-6 p-4 bg-secondary/20 rounded-lg">
                <h3 className="text-sm font-medium mb-3">Session Configuration</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Max Depth:</span>{' '}
                    {selectedSession.max_depth}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Pages:</span>{' '}
                    {selectedSession.max_pages}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Threads:</span>{' '}
                    {selectedSession.threads}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delay:</span>{' '}
                    {selectedSession.delay_ms}ms
                  </div>
                  <div>
                    <span className="text-muted-foreground">Robots.txt:</span>{' '}
                    {selectedSession.respect_robots_txt ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">External Links:</span>{' '}
                    {selectedSession.follow_external_links ? 'Yes' : 'No'}
                  </div>
                </div>
                {selectedSession.start_urls.length > 0 && (
                  <div className="mt-3">
                    <span className="text-muted-foreground text-sm">Start URLs:</span>
                    <div className="mt-1 space-y-1">
                      {selectedSession.start_urls.map((url, i) => (
                        <div key={i} className="text-xs font-mono text-muted-foreground">
                          {url}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a session or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
