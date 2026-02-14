'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Rule, RuleCreate } from '@/types';
import { Save, X } from 'lucide-react';

interface RuleEditorProps {
  rule?: Rule;
  onSave: (rule: RuleCreate) => void;
  onCancel: () => void;
}

export function RuleEditor({ rule, onSave, onCancel }: RuleEditorProps) {
  const [formData, setFormData] = useState<RuleCreate>({
    name: rule?.name || '',
    enabled: rule?.enabled ?? true,
    priority: rule?.priority || 0,
    match_type: rule?.match_type || 'url',
    match_pattern: rule?.match_pattern || '',
    match_regex: rule?.match_regex || false,
    action_type: rule?.action_type || 'replace',
    action_target: rule?.action_target || '',
    action_value: rule?.action_value || '',
    apply_to: rule?.apply_to || 'request',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{rule ? 'Edit Rule' : 'Create Rule'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Rule name"
              required
            />
          </div>

          {/* Enabled & Priority */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <span className="text-sm">Enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Priority:</label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                className="w-20"
              />
            </div>
          </div>

          {/* Match Type */}
          <div>
            <label className="text-sm font-medium">Match Type</label>
            <select
              value={formData.match_type}
              onChange={(e) =>
                setFormData({ ...formData, match_type: e.target.value as RuleCreate['match_type'] })
              }
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm"
            >
              <option value="url">URL</option>
              <option value="header">Header</option>
              <option value="body">Body</option>
              <option value="method">Method</option>
            </select>
          </div>

          {/* Match Pattern */}
          <div>
            <label className="text-sm font-medium">Match Pattern</label>
            <Input
              value={formData.match_pattern}
              onChange={(e) => setFormData({ ...formData, match_pattern: e.target.value })}
              placeholder="Pattern to match"
              required
            />
            <div className="flex items-center gap-2 mt-2">
              <Switch
                checked={formData.match_regex}
                onCheckedChange={(checked) => setFormData({ ...formData, match_regex: checked })}
              />
              <span className="text-sm">Use Regex</span>
            </div>
          </div>

          {/* Action Type */}
          <div>
            <label className="text-sm font-medium">Action Type</label>
            <select
              value={formData.action_type}
              onChange={(e) =>
                setFormData({ ...formData, action_type: e.target.value as RuleCreate['action_type'] })
              }
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm"
            >
              <option value="replace">Replace</option>
              <option value="add_header">Add Header</option>
              <option value="remove_header">Remove Header</option>
              <option value="block">Block</option>
            </select>
          </div>

          {/* Action Target (for header actions) */}
          {(formData.action_type === 'add_header' || formData.action_type === 'remove_header') && (
            <div>
              <label className="text-sm font-medium">Header Name</label>
              <Input
                value={formData.action_target || ''}
                onChange={(e) => setFormData({ ...formData, action_target: e.target.value })}
                placeholder="Header name"
              />
            </div>
          )}

          {/* Action Value */}
          {formData.action_type !== 'block' && formData.action_type !== 'remove_header' && (
            <div>
              <label className="text-sm font-medium">
                {formData.action_type === 'add_header' ? 'Header Value' : 'Replace With'}
              </label>
              <Input
                value={formData.action_value || ''}
                onChange={(e) => setFormData({ ...formData, action_value: e.target.value })}
                placeholder={formData.action_type === 'add_header' ? 'Header value' : 'Replacement text'}
              />
            </div>
          )}

          {/* Apply To */}
          <div>
            <label className="text-sm font-medium">Apply To</label>
            <select
              value={formData.apply_to}
              onChange={(e) =>
                setFormData({ ...formData, apply_to: e.target.value as RuleCreate['apply_to'] })
              }
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm"
            >
              <option value="request">Request</option>
              <option value="response">Response</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button type="submit">
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
