'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Trash2,
  Play,
  Pause,
  Square,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  getScans,
  createScan,
  getScan,
  deleteScan,
  startScan,
  pauseScan,
  stopScan,
  getAvailableChecks,
  getTargets,
} from '@/lib/api';
import type { Scan, ScanCreate, ScanDetail, ScanIssue, CheckInfo, Target } from '@/types';
import { useWebSocket } from '@/lib/websocket';

export default function ScannerPage() {
  const queryClient = useQueryClient();
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newScan, setNewScan] = useState<ScanCreate>({
    name: '',
    source_type: 'url',
    source_urls: [],
    enabled_checks: [],
  });
  const [urlsText, setUrlsText] = useState('');
  const [selectedChecks, setSelectedChecks] = useState<string[]>([]);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // WebSocket for real-time updates
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type === 'scan_progress') {
        queryClient.invalidateQueries({ queryKey: ['scans'] });
        if (selectedScanId) {
          queryClient.invalidateQueries({ queryKey: ['scan', selectedScanId] });
        }
      }
    });

    return unsubscribe;
  }, [subscribe, queryClient, selectedScanId]);

  // Queries
  const { data: scans = [], isLoading: loadingScans } = useQuery({
    queryKey: ['scans'],
    queryFn: getScans,
    refetchInterval: 3000,
  });

  const { data: selectedScan, isLoading: loadingScan } = useQuery({
    queryKey: ['scan', selectedScanId],
    queryFn: () => (selectedScanId ? getScan(selectedScanId) : null),
    enabled: !!selectedScanId,
    refetchInterval: selectedScanId ? 2000 : false,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ['availableChecks'],
    queryFn: getAvailableChecks,
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['targets'],
    queryFn: getTargets,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createScan,
    onSuccess: (scan) => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      setSelectedScanId(scan.id);
      setShowNewForm(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      setSelectedScanId(null);
    },
  });

  const startMutation = useMutation({
    mutationFn: ({ id, checks }: { id: string; checks?: string[] }) => startScan(id, checks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['scan', selectedScanId] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: pauseScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['scan', selectedScanId] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['scan', selectedScanId] });
    },
  });

  const resetForm = () => {
    setNewScan({
      name: '',
      source_type: 'url',
      source_urls: [],
      enabled_checks: [],
    });
    setUrlsText('');
    setSelectedChecks([]);
  };

  const handleCreate = () => {
    const urls = urlsText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u);

    if (!newScan.name || (newScan.source_type === 'url' && urls.length === 0)) {
      return;
    }

    createMutation.mutate({
      ...newScan,
      source_urls: urls,
      enabled_checks: selectedChecks,
    });
  };

  const toggleCheck = (checkId: string) => {
    setSelectedChecks((prev) =>
      prev.includes(checkId) ? prev.filter((c) => c !== checkId) : [...prev, checkId]
    );
  };

  const selectAllChecks = () => {
    setSelectedChecks(checks.map((c) => c.id));
  };

  const clearAllChecks = () => {
    setSelectedChecks([]);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      info: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return `px-2 py-0.5 text-xs rounded border ${colors[severity] || colors.info}`;
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

  const filteredIssues =
    selectedScan?.issues?.filter((issue) => {
      if (severityFilter === 'all') return true;
      return issue.severity === severityFilter;
    }) || [];

  const issueSummary = selectedScan?.issues?.reduce(
    (acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) || {};

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            <h1 className="text-xl font-semibold">Scanner</h1>
          </div>
          <Button onClick={() => setShowNewForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Scan
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Scans List */}
        <div className="w-80 border-r border-border overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Scans ({scans.length})
            </h2>

            {loadingScans ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : scans.length === 0 ? (
              <div className="text-sm text-muted-foreground">No scans yet</div>
            ) : (
              <div className="space-y-2">
                {scans.map((scan) => (
                  <div
                    key={scan.id}
                    onClick={() => {
                      setSelectedScanId(scan.id);
                      setShowNewForm(false);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedScanId === scan.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate">{scan.name}</span>
                      {getStatusIcon(scan.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{scan.issues_found} issues</span>
                      <span>
                        {scan.completed_checks}/{scan.total_checks}
                      </span>
                    </div>
                    {scan.status === 'running' && (
                      <div className="mt-2">
                        <div className="h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${
                                scan.total_checks > 0
                                  ? (scan.completed_checks / scan.total_checks) * 100
                                  : 0
                              }%`,
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
              <h2 className="text-lg font-semibold mb-6">New Vulnerability Scan</h2>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="name">Scan Name</Label>
                  <Input
                    id="name"
                    value={newScan.name}
                    onChange={(e) => setNewScan({ ...newScan, name: e.target.value })}
                    placeholder="e.g., Production API Scan"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Source Type</Label>
                  <div className="flex gap-2 mt-2">
                    {['url', 'target'].map((type) => (
                      <Button
                        key={type}
                        variant={newScan.source_type === type ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setNewScan({ ...newScan, source_type: type })}
                        className="capitalize"
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>

                {newScan.source_type === 'url' ? (
                  <div>
                    <Label htmlFor="urls">Target URLs (one per line)</Label>
                    <Textarea
                      id="urls"
                      value={urlsText}
                      onChange={(e) => setUrlsText(e.target.value)}
                      placeholder="https://example.com/api/users"
                      rows={4}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="target">Select Target</Label>
                    <select
                      id="target"
                      value={newScan.target_id || ''}
                      onChange={(e) => setNewScan({ ...newScan, target_id: e.target.value })}
                      className="mt-1 w-full p-2 bg-background border border-border rounded-md"
                    >
                      <option value="">Select a target...</option>
                      {targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.host} ({target.request_count} requests)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Vulnerability Checks</Label>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={selectAllChecks}>
                        Select All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearAllChecks}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-lg p-3">
                    {checks.map((check) => (
                      <div
                        key={check.id}
                        className="flex items-start gap-3 p-2 hover:bg-secondary/30 rounded"
                      >
                        <Checkbox
                          id={check.id}
                          checked={selectedChecks.includes(check.id)}
                          onCheckedChange={() => toggleCheck(check.id)}
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={check.id}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {check.name}
                          </label>
                          <p className="text-xs text-muted-foreground">{check.description}</p>
                        </div>
                        <span className={getSeverityBadge(check.severity)}>
                          {check.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedChecks.length} checks selected
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    Create Scan
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
          ) : selectedScan ? (
            <div className="p-6">
              {/* Scan Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">{selectedScan.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {getStatusIcon(selectedScan.status)}
                    <span className="capitalize">{selectedScan.status}</span>
                    <span>-</span>
                    <span>
                      {selectedScan.completed_checks}/{selectedScan.total_checks} checks
                    </span>
                    <span>-</span>
                    <span>{selectedScan.issues_found} issues found</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {selectedScan.status === 'configured' && (
                    <Button
                      onClick={() =>
                        startMutation.mutate({
                          id: selectedScan.id,
                          checks: selectedChecks.length > 0 ? selectedChecks : undefined,
                        })
                      }
                      disabled={startMutation.isPending}
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                  )}
                  {selectedScan.status === 'running' && (
                    <>
                      <Button
                        onClick={() => pauseMutation.mutate(selectedScan.id)}
                        disabled={pauseMutation.isPending}
                        variant="outline"
                        size="sm"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </Button>
                      <Button
                        onClick={() => stopMutation.mutate(selectedScan.id)}
                        disabled={stopMutation.isPending}
                        variant="destructive"
                        size="sm"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        Stop
                      </Button>
                    </>
                  )}
                  {(selectedScan.status === 'completed' || selectedScan.status === 'error') && (
                    <Button
                      onClick={() => deleteMutation.mutate(selectedScan.id)}
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
              {selectedScan.status === 'running' && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>
                      {selectedScan.total_checks > 0
                        ? Math.round(
                            (selectedScan.completed_checks / selectedScan.total_checks) * 100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${
                          selectedScan.total_checks > 0
                            ? (selectedScan.completed_checks / selectedScan.total_checks) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Issue Summary */}
              {selectedScan.issues && selectedScan.issues.length > 0 && (
                <div className="mb-6 flex gap-4">
                  {['critical', 'high', 'medium', 'low', 'info'].map((severity) => (
                    <div
                      key={severity}
                      onClick={() =>
                        setSeverityFilter(severityFilter === severity ? 'all' : severity)
                      }
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        severityFilter === severity
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {getSeverityIcon(severity)}
                      <span className="capitalize text-sm">{severity}</span>
                      <span className="text-sm font-medium">{issueSummary[severity] || 0}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Issues List */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-secondary/30 px-4 py-2 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    Issues ({filteredIssues.length})
                  </h3>
                  {severityFilter !== 'all' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSeverityFilter('all')}
                    >
                      Clear filter
                    </Button>
                  )}
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredIssues.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>
                        {selectedScan.status === 'configured'
                          ? 'Start the scan to discover vulnerabilities'
                          : selectedScan.status === 'running'
                            ? 'Scanning for vulnerabilities...'
                            : 'No issues found'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredIssues.map((issue) => (
                        <div key={issue.id} className="hover:bg-secondary/20">
                          <div
                            onClick={() =>
                              setExpandedIssue(expandedIssue === issue.id ? null : issue.id)
                            }
                            className="px-4 py-3 cursor-pointer"
                          >
                            <div className="flex items-start gap-3">
                              {expandedIssue === issue.id ? (
                                <ChevronDown className="w-4 h-4 mt-1 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground" />
                              )}
                              {getSeverityIcon(issue.severity)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{issue.title}</span>
                                  <span className={getSeverityBadge(issue.severity)}>
                                    {issue.severity}
                                  </span>
                                  <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary rounded">
                                    {issue.confidence}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground truncate mt-1">
                                  {issue.method} {issue.url}
                                  {issue.parameter && ` - ${issue.parameter}`}
                                </div>
                              </div>
                            </div>
                          </div>

                          {expandedIssue === issue.id && (
                            <div className="px-4 pb-4 pl-11 space-y-4">
                              {issue.description && (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">Description</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {issue.description}
                                  </p>
                                </div>
                              )}

                              {issue.evidence && (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">Evidence</h4>
                                  <pre className="text-xs bg-secondary/50 p-2 rounded overflow-x-auto">
                                    {issue.evidence}
                                  </pre>
                                </div>
                              )}

                              {issue.payload && (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">Payload</h4>
                                  <pre className="text-xs bg-secondary/50 p-2 rounded font-mono">
                                    {issue.payload}
                                  </pre>
                                </div>
                              )}

                              {issue.remediation && (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">Remediation</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {issue.remediation}
                                  </p>
                                </div>
                              )}

                              {issue.references && issue.references.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">References</h4>
                                  <div className="space-y-1">
                                    {issue.references.map((ref, i) => (
                                      <a
                                        key={i}
                                        href={ref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-sm text-blue-400 hover:underline"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        {ref}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a scan or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
