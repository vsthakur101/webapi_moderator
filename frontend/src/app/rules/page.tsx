'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RuleEditor } from '@/components/RuleEditor';
import { getRules, createRule, updateRule, deleteRule, toggleRule } from '@/lib/api';
import type { Rule, RuleCreate } from '@/types';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';

export default function RulesPage() {
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: getRules,
  });

  const createMutation = useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setIsCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: Partial<RuleCreate> }) => updateRule(id, rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setEditingRule(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const handleSave = (rule: RuleCreate) => {
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, rule });
    } else {
      createMutation.mutate(rule);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      deleteMutation.mutate(id);
    }
  };

  const getActionBadge = (rule: Rule) => {
    switch (rule.action_type) {
      case 'replace':
        return <Badge variant="info">Replace</Badge>;
      case 'add_header':
        return <Badge variant="success">Add Header</Badge>;
      case 'remove_header':
        return <Badge variant="warning">Remove Header</Badge>;
      case 'block':
        return <Badge variant="destructive">Block</Badge>;
      default:
        return null;
    }
  };

  if (isCreating || editingRule) {
    return (
      <div className="flex flex-col h-full">
        <header className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold">{editingRule ? 'Edit Rule' : 'Create Rule'}</h1>
        </header>
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl">
            <RuleEditor
              rule={editingRule || undefined}
              onSave={handleSave}
              onCancel={() => {
                setIsCreating(false);
                setEditingRule(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Auto-Replace Rules</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically modify requests and responses based on patterns
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Create Rule
          </Button>
        </div>
      </header>

      {/* Rules list */}
      <div className="flex-1 p-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">Loading...</div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Shield className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">No rules configured</p>
            <p className="text-sm mt-2">Create a rule to automatically modify requests</p>
            <Button className="mt-4" onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Create Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id} className={rule.enabled ? 'bg-card' : 'bg-card/50 opacity-60'}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleMutation.mutate(rule.id)}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rule.name}</span>
                          {getActionBadge(rule)}
                          <Badge variant="outline">{rule.apply_to}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Match {rule.match_type}:{' '}
                          <code className="bg-muted px-1 rounded">{rule.match_pattern}</code>
                          {rule.match_regex && <Badge variant="secondary" className="ml-2 text-xs">Regex</Badge>}
                        </div>
                        {rule.action_type === 'replace' && rule.action_value && (
                          <div className="text-sm text-muted-foreground">
                            Replace with: <code className="bg-muted px-1 rounded">{rule.action_value}</code>
                          </div>
                        )}
                        {rule.action_type === 'add_header' && (
                          <div className="text-sm text-muted-foreground">
                            Add header: <code className="bg-muted px-1 rounded">{rule.action_target}: {rule.action_value}</code>
                          </div>
                        )}
                        {rule.action_type === 'remove_header' && (
                          <div className="text-sm text-muted-foreground">
                            Remove header: <code className="bg-muted px-1 rounded">{rule.action_target}</code>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditingRule(rule)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
