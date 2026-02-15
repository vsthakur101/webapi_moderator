'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  getTargets,
  getSiteMap,
  updateTarget,
  deleteTarget,
  rebuildSiteMap,
} from '@/lib/api';
import type { Target, SiteMapTreeNode } from '@/types';
import {
  Target as TargetIcon,
  RefreshCw,
  Trash2,
  ChevronRight,
  ChevronDown,
  Globe,
  Folder,
  FileText,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TargetPage() {
  const queryClient = useQueryClient();
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Fetch targets
  const { data: targets = [], isLoading: targetsLoading } = useQuery({
    queryKey: ['targets'],
    queryFn: getTargets,
  });

  // Fetch site map for selected target
  const { data: siteMap = [], isLoading: siteMapLoading } = useQuery({
    queryKey: ['sitemap', selectedTargetId],
    queryFn: () => getSiteMap(selectedTargetId!),
    enabled: !!selectedTargetId,
  });

  // Rebuild site map mutation
  const rebuildMutation = useMutation({
    mutationFn: rebuildSiteMap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['sitemap'] });
    },
  });

  // Update target mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { in_scope?: boolean } }) =>
      updateTarget(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });

  // Delete target mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTarget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      setSelectedTargetId(null);
    },
  });

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const expandAll = () => {
    const allPaths = new Set<string>();
    const collectPaths = (nodes: SiteMapTreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          allPaths.add(node.path);
          collectPaths(node.children);
        }
      });
    };
    collectPaths(siteMap);
    setExpandedPaths(allPaths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set());
  };

  const selectedTarget = targets.find((t) => t.id === selectedTargetId);

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-500/20 text-green-500';
      case 'POST':
        return 'bg-blue-500/20 text-blue-500';
      case 'PUT':
        return 'bg-yellow-500/20 text-yellow-500';
      case 'PATCH':
        return 'bg-orange-500/20 text-orange-500';
      case 'DELETE':
        return 'bg-red-500/20 text-red-500';
      default:
        return 'bg-gray-500/20 text-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Target</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View discovered hosts and site structure
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => rebuildMutation.mutate()}
          disabled={rebuildMutation.isPending}
        >
          <RefreshCw
            className={cn('w-4 h-4 mr-2', rebuildMutation.isPending && 'animate-spin')}
          />
          Rebuild Site Map
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Targets List */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-sm text-muted-foreground">
              Discovered Hosts ({targets.length})
            </h2>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {targetsLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : targets.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No targets discovered</p>
                <p className="text-xs mt-1">Browse the web through the proxy</p>
              </div>
            ) : (
              <div className="space-y-1">
                {targets.map((target) => (
                  <div
                    key={target.id}
                    className={cn(
                      'p-3 rounded-lg cursor-pointer transition-colors',
                      selectedTargetId === target.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => setSelectedTargetId(target.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span className="font-mono text-sm truncate">{target.host}</span>
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-2 mt-1 text-xs',
                        selectedTargetId === target.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      )}
                    >
                      <span>{target.request_count} requests</span>
                      {!target.in_scope && (
                        <Badge variant="secondary" className="text-xs">
                          Out of scope
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Site Map */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTargetId ? (
            <>
              {/* Target Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5" />
                  <div>
                    <h2 className="font-semibold font-mono">{selectedTarget?.host}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedTarget?.request_count} requests captured
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">In Scope</span>
                    <Switch
                      checked={selectedTarget?.in_scope ?? true}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({
                          id: selectedTargetId,
                          updates: { in_scope: checked },
                        })
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Delete this target and its site map?')) {
                        deleteMutation.mutate(selectedTargetId);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Site Map Controls */}
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={expandAll}>
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll}>
                  Collapse All
                </Button>
              </div>

              {/* Site Map Tree */}
              <div className="flex-1 overflow-auto p-4">
                {siteMapLoading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Loading site map...
                  </div>
                ) : siteMap.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Folder className="w-12 h-12 mb-3 opacity-50" />
                    <p>No site structure found</p>
                    <p className="text-xs mt-1">
                      Click "Rebuild Site Map" to build from history
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {siteMap.map((node) => (
                      <SiteMapTreeNodeComponent
                        key={node.path}
                        node={node}
                        expandedPaths={expandedPaths}
                        onToggle={toggleExpanded}
                        getMethodColor={getMethodColor}
                        depth={0}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <TargetIcon className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">Select a target</p>
              <p className="text-sm">Choose a host to view its site map</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Site Map Tree Node Component
function SiteMapTreeNodeComponent({
  node,
  expandedPaths,
  onToggle,
  getMethodColor,
  depth,
}: {
  node: SiteMapTreeNode;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  getMethodColor: (method: string) => string;
  depth: number;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedPaths.has(node.path);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted cursor-pointer',
          depth > 0 && 'ml-4'
        )}
        style={{ marginLeft: depth * 16 }}
        onClick={() => hasChildren && onToggle(node.path)}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )
        ) : (
          <span className="w-4" />
        )}

        {/* Node Icon */}
        {node.node_type === 'folder' || hasChildren ? (
          <Folder className="w-4 h-4 text-yellow-500" />
        ) : (
          <FileText className="w-4 h-4 text-muted-foreground" />
        )}

        {/* Node Name */}
        <span className="font-mono text-sm">{node.name}</span>

        {/* Methods */}
        {node.methods.length > 0 && (
          <div className="flex gap-1 ml-2">
            {node.methods.map((method) => (
              <Badge
                key={method}
                variant="secondary"
                className={cn('text-xs px-1.5 py-0', getMethodColor(method))}
              >
                {method}
              </Badge>
            ))}
          </div>
        )}

        {/* Request Count */}
        {node.request_count > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {node.request_count}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <SiteMapTreeNodeComponent
              key={child.path}
              node={child}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              getMethodColor={getMethodColor}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
