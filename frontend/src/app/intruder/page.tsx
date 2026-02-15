'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getIntruderAttacks,
  createIntruderAttack,
  deleteIntruderAttack,
  startIntruderAttack,
  pauseIntruderAttack,
  stopIntruderAttack,
  getIntruderResults,
  getBuiltinPayloads,
  getBuiltinPayloadList,
} from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import type { IntruderAttack, IntruderResult, AttackType, BuiltinPayloadList } from '@/types';
import {
  Crosshair,
  Plus,
  Trash2,
  Play,
  Pause,
  Square,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ATTACK_TYPES: { value: AttackType; label: string; description: string }[] = [
  { value: 'sniper', label: 'Sniper', description: 'Single position at a time' },
  { value: 'battering_ram', label: 'Battering Ram', description: 'Same payload all positions' },
  { value: 'pitchfork', label: 'Pitchfork', description: 'Parallel payloads' },
  { value: 'cluster_bomb', label: 'Cluster Bomb', description: 'All combinations' },
];

export default function IntruderPage() {
  const queryClient = useQueryClient();
  const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newAttackName, setNewAttackName] = useState('');
  const [newAttackUrl, setNewAttackUrl] = useState('');
  const [newAttackMethod, setNewAttackMethod] = useState('GET');
  const [newAttackType, setNewAttackType] = useState<AttackType>('sniper');
  const [payloadInput, setPayloadInput] = useState('');
  const [liveResults, setLiveResults] = useState<IntruderResult[]>([]);

  // Fetch attacks
  const { data: attacks = [], isLoading: attacksLoading } = useQuery({
    queryKey: ['intruder-attacks'],
    queryFn: getIntruderAttacks,
    refetchInterval: 5000,
  });

  // Fetch results for selected attack
  const { data: results = [] } = useQuery({
    queryKey: ['intruder-results', selectedAttackId],
    queryFn: () => getIntruderResults(selectedAttackId!, 100),
    enabled: !!selectedAttackId,
    refetchInterval: 2000,
  });

  // Fetch builtin payloads
  const { data: builtinPayloads = [] } = useQuery({
    queryKey: ['builtin-payloads'],
    queryFn: getBuiltinPayloads,
  });

  // WebSocket subscription for live updates
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === 'intruder_result' && message.data.attack_id === selectedAttackId) {
        setLiveResults((prev) => [...prev, message.data.result].slice(-100));
        queryClient.invalidateQueries({ queryKey: ['intruder-attacks'] });
      }
      if (message.type === 'intruder_progress' && message.data.attack_id === selectedAttackId) {
        queryClient.invalidateQueries({ queryKey: ['intruder-attacks'] });
      }
    });
    return unsubscribe;
  }, [selectedAttackId, queryClient]);

  // Reset live results when attack changes
  useEffect(() => {
    setLiveResults([]);
  }, [selectedAttackId]);

  // Create attack mutation
  const createMutation = useMutation({
    mutationFn: createIntruderAttack,
    onSuccess: (attack) => {
      queryClient.invalidateQueries({ queryKey: ['intruder-attacks'] });
      setIsCreating(false);
      setNewAttackName('');
      setNewAttackUrl('');
      setSelectedAttackId(attack.id);
    },
  });

  // Delete attack mutation
  const deleteMutation = useMutation({
    mutationFn: deleteIntruderAttack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intruder-attacks'] });
      setSelectedAttackId(null);
    },
  });

  // Start attack mutation
  const startMutation = useMutation({
    mutationFn: startIntruderAttack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intruder-attacks'] });
    },
  });

  // Pause attack mutation
  const pauseMutation = useMutation({
    mutationFn: pauseIntruderAttack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intruder-attacks'] });
    },
  });

  // Stop attack mutation
  const stopMutation = useMutation({
    mutationFn: stopIntruderAttack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intruder-attacks'] });
    },
  });

  const handleCreateAttack = () => {
    if (!newAttackName.trim() || !newAttackUrl.trim()) return;

    // Parse payloads from textarea
    const payloads = payloadInput
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    createMutation.mutate({
      name: newAttackName.trim(),
      method: newAttackMethod,
      url_template: newAttackUrl.trim(),
      attack_type: newAttackType,
      payload_sets: payloads.length > 0 ? [payloads] : [],
      positions: [],
    });
  };

  const loadBuiltinPayloads = async (name: string) => {
    try {
      const data = await getBuiltinPayloadList(name);
      setPayloadInput(data.payloads.join('\n'));
    } catch (error) {
      console.error('Failed to load payloads:', error);
    }
  };

  const selectedAttack = attacks.find((a) => a.id === selectedAttackId);
  const displayResults = liveResults.length > 0 ? liveResults : results;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: number | undefined) => {
    if (!status) return 'text-muted-foreground';
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 300 && status < 400) return 'text-blue-500';
    if (status >= 400 && status < 500) return 'text-yellow-500';
    if (status >= 500) return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold">Intruder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automated attack and fuzzing tool
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Attacks List */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <Button
              className="w-full"
              onClick={() => setIsCreating(true)}
              disabled={isCreating}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Attack
            </Button>
          </div>

          {/* Create Attack Form */}
          {isCreating && (
            <div className="p-4 border-b border-border bg-muted/50 space-y-3">
              <Input
                placeholder="Attack name"
                value={newAttackName}
                onChange={(e) => setNewAttackName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 bg-muted rounded-lg text-sm"
                  value={newAttackMethod}
                  onChange={(e) => setNewAttackMethod(e.target.value)}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <Input
                  placeholder="URL template"
                  value={newAttackUrl}
                  onChange={(e) => setNewAttackUrl(e.target.value)}
                  className="flex-1"
                />
              </div>
              <select
                className="w-full px-3 py-2 bg-muted rounded-lg text-sm"
                value={newAttackType}
                onChange={(e) => setNewAttackType(e.target.value as AttackType)}
              >
                {ATTACK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateAttack}
                  disabled={!newAttackName.trim() || !newAttackUrl.trim() || createMutation.isPending}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewAttackName('');
                    setNewAttackUrl('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Attacks List */}
          <div className="flex-1 overflow-auto p-2">
            {attacksLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : attacks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Crosshair className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No attacks configured</p>
                <p className="text-xs mt-1">Create an attack to get started</p>
              </div>
            ) : (
              <div className="space-y-1">
                {attacks.map((attack) => (
                  <div
                    key={attack.id}
                    className={cn(
                      'p-3 rounded-lg cursor-pointer transition-colors',
                      selectedAttackId === attack.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => setSelectedAttackId(attack.id)}
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(attack.status)}
                      <span className="font-medium truncate">{attack.name}</span>
                    </div>
                    <div
                      className={cn(
                        'text-xs mt-1',
                        selectedAttackId === attack.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      )}
                    >
                      {attack.completed_requests}/{attack.total_requests} requests
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Attack Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedAttack ? (
            <>
              {/* Attack Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedAttack.status)}
                  <div>
                    <h2 className="font-semibold">{selectedAttack.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedAttack.method} {selectedAttack.url_template}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedAttack.status === 'running' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pauseMutation.mutate(selectedAttack.id)}
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => stopMutation.mutate(selectedAttack.id)}
                      >
                        <Square className="w-4 h-4 mr-1" />
                        Stop
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => startMutation.mutate(selectedAttack.id)}
                      disabled={startMutation.isPending}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      {selectedAttack.status === 'paused' ? 'Resume' : 'Start'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Delete this attack?')) {
                        deleteMutation.mutate(selectedAttack.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              {selectedAttack.total_requests > 0 && (
                <div className="px-4 py-2 border-b border-border">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span>
                      {selectedAttack.completed_requests} / {selectedAttack.total_requests}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(selectedAttack.completed_requests / selectedAttack.total_requests) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Tabs */}
              <Tabs defaultValue="results" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-4 mt-2">
                  <TabsTrigger value="results">Results</TabsTrigger>
                  <TabsTrigger value="config">Configuration</TabsTrigger>
                  <TabsTrigger value="payloads">Payloads</TabsTrigger>
                </TabsList>

                {/* Results Tab */}
                <TabsContent value="results" className="flex-1 overflow-auto p-4">
                  {displayResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Crosshair className="w-12 h-12 mb-3 opacity-50" />
                      <p>No results yet</p>
                      <p className="text-xs mt-1">Start the attack to see results</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground px-3 py-2 border-b">
                        <span className="col-span-2">Payload</span>
                        <span>Status</span>
                        <span>Length</span>
                        <span>Time</span>
                        <span>Error</span>
                      </div>
                      {displayResults.map((result, idx) => (
                        <div
                          key={result.id || idx}
                          className="grid grid-cols-6 gap-2 text-sm px-3 py-2 hover:bg-muted rounded"
                        >
                          <span className="col-span-2 font-mono truncate">
                            {result.payloads.join(', ')}
                          </span>
                          <span className={getStatusColor(result.response_status)}>
                            {result.response_status || '-'}
                          </span>
                          <span>{result.response_length || '-'}</span>
                          <span>{result.response_time_ms ? `${result.response_time_ms}ms` : '-'}</span>
                          <span className="text-red-500 truncate" title={result.error}>
                            {result.error || '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Configuration Tab */}
                <TabsContent value="config" className="flex-1 overflow-auto p-4">
                  <div className="space-y-4 max-w-2xl">
                    <div>
                      <label className="text-sm font-medium">Attack Type</label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {ATTACK_TYPES.map((type) => (
                          <div
                            key={type.value}
                            className={cn(
                              'p-3 rounded-lg border cursor-pointer',
                              selectedAttack.attack_type === type.value
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            )}
                          >
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {type.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Request Template</label>
                      <div className="mt-2 p-3 bg-muted rounded-lg font-mono text-sm">
                        <div>
                          <span className="text-green-500">{selectedAttack.method}</span>{' '}
                          {selectedAttack.url_template}
                        </div>
                        {Object.entries(selectedAttack.headers_template).map(([key, value]) => (
                          <div key={key} className="text-muted-foreground">
                            {key}: {value}
                          </div>
                        ))}
                        {selectedAttack.body_template && (
                          <div className="mt-2 pt-2 border-t border-border">
                            {selectedAttack.body_template}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Threads</label>
                        <Input
                          type="number"
                          value={selectedAttack.threads}
                          readOnly
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Delay (ms)</label>
                        <Input
                          type="number"
                          value={selectedAttack.delay_ms}
                          readOnly
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Payloads Tab */}
                <TabsContent value="payloads" className="flex-1 overflow-auto p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Payload Sets</label>
                      <div className="mt-2 space-y-2">
                        {(selectedAttack.payload_sets || []).map((payloads, idx) => (
                          <div key={idx} className="p-3 bg-muted rounded-lg">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Set {idx + 1} ({payloads.length} payloads)
                            </div>
                            <div className="font-mono text-sm max-h-32 overflow-auto">
                              {payloads.slice(0, 10).join(', ')}
                              {payloads.length > 10 && ` ... and ${payloads.length - 10} more`}
                            </div>
                          </div>
                        ))}
                        {(!selectedAttack.payload_sets || selectedAttack.payload_sets.length === 0) && (
                          <div className="p-4 text-center text-muted-foreground">
                            No payloads configured
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Built-in Payload Lists</label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {builtinPayloads.map((list) => (
                          <div
                            key={list.name}
                            className="p-3 border rounded-lg hover:border-primary cursor-pointer"
                            onClick={() => loadBuiltinPayloads(list.name.toLowerCase().replace(/\s+/g, '_'))}
                          >
                            <div className="font-medium text-sm">{list.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {list.count} payloads
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Crosshair className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">Select an attack</p>
              <p className="text-sm">Choose an attack to view its configuration and results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
