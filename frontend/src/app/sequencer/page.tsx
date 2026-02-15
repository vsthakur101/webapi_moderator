'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getSequencerAnalyses,
  createSequencerAnalysis,
  getSequencerAnalysis,
  deleteSequencerAnalysis,
  addSequencerSamples,
  runSequencerAnalysis,
  resetSequencerAnalysis,
  analyzeTokensManual,
} from '@/lib/api';
import type { SequencerAnalysis, SequencerAnalysisDetail, ExtractionType, AnalysisResults } from '@/types';
import {
  Shuffle,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const EXTRACTION_TYPES: { value: ExtractionType; label: string; description: string }[] = [
  { value: 'header', label: 'Header', description: 'Extract from response header' },
  { value: 'cookie', label: 'Cookie', description: 'Extract from Set-Cookie header' },
  { value: 'body_regex', label: 'Body (Regex)', description: 'Extract using regex from body' },
  { value: 'body_json', label: 'Body (JSON)', description: 'Extract from JSON path in body' },
];

export default function SequencerPage() {
  const queryClient = useQueryClient();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newAnalysisName, setNewAnalysisName] = useState('');
  const [newExtractionType, setNewExtractionType] = useState<ExtractionType>('header');
  const [newExtractionPattern, setNewExtractionPattern] = useState('');
  const [newSampleCount, setNewSampleCount] = useState(100);
  const [manualTokens, setManualTokens] = useState('');
  const [manualResults, setManualResults] = useState<AnalysisResults | null>(null);
  const [activeTab, setActiveTab] = useState('analyses');

  // Fetch analyses
  const { data: analyses = [], isLoading: analysesLoading } = useQuery({
    queryKey: ['sequencer-analyses'],
    queryFn: getSequencerAnalyses,
  });

  // Fetch selected analysis details
  const { data: selectedAnalysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['sequencer-analysis', selectedAnalysisId],
    queryFn: () => getSequencerAnalysis(selectedAnalysisId!),
    enabled: !!selectedAnalysisId,
  });

  // Create analysis mutation
  const createMutation = useMutation({
    mutationFn: createSequencerAnalysis,
    onSuccess: (analysis) => {
      queryClient.invalidateQueries({ queryKey: ['sequencer-analyses'] });
      setIsCreating(false);
      setNewAnalysisName('');
      setNewExtractionPattern('');
      setSelectedAnalysisId(analysis.id);
    },
  });

  // Delete analysis mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSequencerAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequencer-analyses'] });
      setSelectedAnalysisId(null);
    },
  });

  // Add samples mutation
  const addSamplesMutation = useMutation({
    mutationFn: ({ id, samples }: { id: string; samples: string[] }) =>
      addSequencerSamples(id, samples),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequencer-analysis', selectedAnalysisId] });
      queryClient.invalidateQueries({ queryKey: ['sequencer-analyses'] });
    },
  });

  // Run analysis mutation
  const runAnalysisMutation = useMutation({
    mutationFn: runSequencerAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequencer-analysis', selectedAnalysisId] });
      queryClient.invalidateQueries({ queryKey: ['sequencer-analyses'] });
    },
  });

  // Reset analysis mutation
  const resetMutation = useMutation({
    mutationFn: resetSequencerAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequencer-analysis', selectedAnalysisId] });
      queryClient.invalidateQueries({ queryKey: ['sequencer-analyses'] });
    },
  });

  // Manual analysis mutation
  const manualAnalysisMutation = useMutation({
    mutationFn: analyzeTokensManual,
    onSuccess: (results) => {
      setManualResults(results);
    },
  });

  const handleCreateAnalysis = () => {
    if (!newAnalysisName.trim() || !newExtractionPattern.trim()) return;
    createMutation.mutate({
      name: newAnalysisName.trim(),
      extraction_type: newExtractionType,
      extraction_pattern: newExtractionPattern.trim(),
      sample_count: newSampleCount,
    });
  };

  const handleAddSamples = () => {
    if (!selectedAnalysisId) return;
    const tokens = manualTokens
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tokens.length === 0) return;
    addSamplesMutation.mutate({ id: selectedAnalysisId, samples: tokens });
    setManualTokens('');
  };

  const handleManualAnalysis = () => {
    const tokens = manualTokens
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tokens.length === 0) return;
    manualAnalysisMutation.mutate(tokens);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'collecting':
      case 'analyzing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEntropyColor = (rating: string) => {
    switch (rating) {
      case 'Excellent':
        return 'text-green-500';
      case 'Good':
        return 'text-blue-500';
      case 'Fair':
        return 'text-yellow-500';
      case 'Poor':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold">Sequencer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analyze token randomness and entropy
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="analyses">Saved Analyses</TabsTrigger>
            <TabsTrigger value="manual">Manual Analysis</TabsTrigger>
          </TabsList>

          {/* Saved Analyses Tab */}
          <TabsContent value="analyses" className="space-y-4">
            <div className="flex gap-6">
              {/* Analyses List */}
              <div className="w-80 space-y-4">
                <Button
                  className="w-full"
                  onClick={() => setIsCreating(true)}
                  disabled={isCreating}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Analysis
                </Button>

                {/* Create Form */}
                {isCreating && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <Input
                        placeholder="Analysis name"
                        value={newAnalysisName}
                        onChange={(e) => setNewAnalysisName(e.target.value)}
                        autoFocus
                      />
                      <select
                        className="w-full px-3 py-2 bg-muted rounded-lg text-sm"
                        value={newExtractionType}
                        onChange={(e) => setNewExtractionType(e.target.value as ExtractionType)}
                      >
                        {EXTRACTION_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="Extraction pattern (header name, regex, etc.)"
                        value={newExtractionPattern}
                        onChange={(e) => setNewExtractionPattern(e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Sample count"
                        value={newSampleCount}
                        onChange={(e) => setNewSampleCount(parseInt(e.target.value) || 100)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleCreateAnalysis}
                          disabled={createMutation.isPending}
                        >
                          Create
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsCreating(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Analyses List */}
                <div className="space-y-1">
                  {analysesLoading ? (
                    <div className="p-4 text-center text-muted-foreground">Loading...</div>
                  ) : analyses.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Shuffle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No analyses yet</p>
                    </div>
                  ) : (
                    analyses.map((analysis) => (
                      <div
                        key={analysis.id}
                        className={cn(
                          'p-3 rounded-lg cursor-pointer transition-colors',
                          selectedAnalysisId === analysis.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        )}
                        onClick={() => setSelectedAnalysisId(analysis.id)}
                      >
                        <div className="flex items-center gap-2">
                          {getStatusIcon(analysis.status)}
                          <span className="font-medium truncate">{analysis.name}</span>
                        </div>
                        <div
                          className={cn(
                            'text-xs mt-1',
                            selectedAnalysisId === analysis.id
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          )}
                        >
                          {analysis.collected_count}/{analysis.sample_count} samples
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Analysis Detail */}
              <div className="flex-1">
                {selectedAnalysis ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(selectedAnalysis.status)}
                          <CardTitle>{selectedAnalysis.name}</CardTitle>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => runAnalysisMutation.mutate(selectedAnalysis.id)}
                            disabled={
                              runAnalysisMutation.isPending ||
                              selectedAnalysis.collected_count === 0
                            }
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Analyze
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resetMutation.mutate(selectedAnalysis.id)}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Reset
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(selectedAnalysis.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription>
                        {selectedAnalysis.extraction_type}: {selectedAnalysis.extraction_pattern}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Add Samples */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Add Samples</label>
                        <textarea
                          className="w-full h-24 p-3 bg-muted rounded-lg font-mono text-sm resize-none"
                          placeholder="Paste tokens here, one per line..."
                          value={manualTokens}
                          onChange={(e) => setManualTokens(e.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={handleAddSamples}
                          disabled={addSamplesMutation.isPending}
                        >
                          Add Samples
                        </Button>
                      </div>

                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Samples Collected</span>
                          <span>
                            {selectedAnalysis.collected_count} / {selectedAnalysis.sample_count}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${(selectedAnalysis.collected_count / selectedAnalysis.sample_count) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Results */}
                      {selectedAnalysis.analysis_results && (
                        <AnalysisResultsDisplay results={selectedAnalysis.analysis_results} />
                      )}

                      {/* Samples Preview */}
                      {selectedAnalysis.samples && selectedAnalysis.samples.length > 0 && (
                        <div>
                          <label className="text-sm font-medium">
                            Samples ({selectedAnalysis.samples.length})
                          </label>
                          <div className="mt-2 p-3 bg-muted rounded-lg font-mono text-xs max-h-32 overflow-auto">
                            {selectedAnalysis.samples.slice(0, 20).map((sample, idx) => (
                              <div key={idx} className="truncate">
                                {sample}
                              </div>
                            ))}
                            {selectedAnalysis.samples.length > 20 && (
                              <div className="text-muted-foreground">
                                ... and {selectedAnalysis.samples.length - 20} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Shuffle className="w-16 h-16 mb-4 opacity-50" />
                    <p>Select an analysis to view details</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Manual Analysis Tab */}
          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Manual Token Analysis</CardTitle>
                <CardDescription>
                  Paste tokens directly for one-time analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Tokens (one per line)</label>
                  <textarea
                    className="w-full h-48 p-3 bg-muted rounded-lg font-mono text-sm resize-none mt-2"
                    placeholder="Paste session tokens, CSRF tokens, or other values here..."
                    value={manualTokens}
                    onChange={(e) => setManualTokens(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleManualAnalysis}
                  disabled={manualAnalysisMutation.isPending}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analyze Tokens
                </Button>

                {manualResults && <AnalysisResultsDisplay results={manualResults} />}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Analysis Results Display Component
function AnalysisResultsDisplay({ results }: { results: AnalysisResults }) {
  const getEntropyColor = (rating: string) => {
    switch (rating) {
      case 'Excellent':
        return 'text-green-500 bg-green-500/10';
      case 'Good':
        return 'text-blue-500 bg-blue-500/10';
      case 'Fair':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'Poor':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        Analysis Results
      </h3>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold">{results.total_samples}</div>
          <div className="text-xs text-muted-foreground">Total Samples</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold">{results.unique_samples}</div>
          <div className="text-xs text-muted-foreground">Unique Samples</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold">{results.avg_length}</div>
          <div className="text-xs text-muted-foreground">Avg Length</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold">{results.character_set.length}</div>
          <div className="text-xs text-muted-foreground">Charset Size</div>
        </div>
      </div>

      {/* Entropy */}
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">Entropy Analysis</span>
          <Badge className={getEntropyColor(results.entropy.rating)}>
            {results.entropy.rating}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Entropy</div>
            <div className="font-mono">{results.entropy.entropy_bits.toFixed(4)} bits</div>
          </div>
          <div>
            <div className="text-muted-foreground">Max Entropy</div>
            <div className="font-mono">{results.entropy.max_entropy.toFixed(4)} bits</div>
          </div>
          <div>
            <div className="text-muted-foreground">Efficiency</div>
            <div className="font-mono">{(results.entropy.efficiency * 100).toFixed(1)}%</div>
          </div>
        </div>
        <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all',
              results.entropy.efficiency >= 0.7 ? 'bg-green-500' :
              results.entropy.efficiency >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
            )}
            style={{ width: `${results.entropy.efficiency * 100}%` }}
          />
        </div>
      </div>

      {/* Patterns */}
      <div className="p-4 bg-muted rounded-lg">
        <div className="font-medium mb-2">Pattern Detection</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            {results.patterns.has_sequential ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            <span>Sequential patterns: {results.patterns.has_sequential ? 'Detected' : 'None'}</span>
          </div>
          <div className="flex items-center gap-2">
            {results.patterns.has_repeated ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            <span>Repeated values: {results.patterns.has_repeated ? 'Detected' : 'None'}</span>
          </div>
        </div>
        {results.patterns.common_prefixes.length > 0 && (
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground">Common prefixes: </span>
            {results.patterns.common_prefixes.join(', ')}
          </div>
        )}
      </div>

      {/* Character Frequencies */}
      <div className="p-4 bg-muted rounded-lg">
        <div className="font-medium mb-2">Top Character Frequencies</div>
        <div className="flex flex-wrap gap-2">
          {results.character_frequencies.slice(0, 10).map((cf, idx) => (
            <div key={idx} className="px-2 py-1 bg-background rounded text-xs font-mono">
              '{cf.character}': {cf.percentage}%
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div
        className={cn(
          'p-4 rounded-lg',
          results.entropy.efficiency >= 0.7
            ? 'bg-green-500/10 border border-green-500/20'
            : 'bg-yellow-500/10 border border-yellow-500/20'
        )}
      >
        <div className="font-medium mb-1">Recommendation</div>
        <p className="text-sm">{results.recommendation}</p>
      </div>
    </div>
  );
}
