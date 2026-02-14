'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { toggleIntercept } from '@/lib/api';
import { RefreshCw, X, Settings, Shield, Plus } from 'lucide-react';

const CLEAR_SELECTION_EVENT = 'app:clear-selection';
const INTERCEPT_UPDATED_EVENT = 'proxy:intercept-updated';

function isEditableTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (target.isContentEditable) return true;

  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function AppContextMenu({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isToggling, setIsToggling] = useState(false);

  const shouldOpen = useCallback((e: React.MouseEvent) => !isEditableTarget(e.target), []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries();
    queryClient.refetchQueries({ type: 'active' });
  }, [queryClient]);

  const handleClearSelection = useCallback(() => {
    window.dispatchEvent(new CustomEvent(CLEAR_SELECTION_EVENT));
  }, []);

  const handleOpenSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  const handleNewRule = useCallback(() => {
    router.push('/rules?new=1');
  }, [router]);

  const handleToggleIntercept = useCallback(async () => {
    if (isToggling) return;

    setIsToggling(true);
    try {
      const result = await toggleIntercept();
      window.dispatchEvent(
        new CustomEvent(INTERCEPT_UPDATED_EVENT, {
          detail: result.intercept_enabled,
        })
      );
    } catch (error) {
      console.error('Failed to toggle intercept:', error);
      alert('Failed to toggle intercept. Please try again.');
    } finally {
      setIsToggling(false);
    }
  }, [isToggling]);

  const menu = useMemo(
    () => (
      <div>
        <ContextMenuLabel>Global Actions</ContextMenuLabel>
        <ContextMenuItem onClick={handleRefresh} icon={<RefreshCw className="h-4 w-4" />}>
          Refresh data
        </ContextMenuItem>
        <ContextMenuItem onClick={handleClearSelection} icon={<X className="h-4 w-4" />}>
          Clear selection
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleOpenSettings} icon={<Settings className="h-4 w-4" />}>
          Open settings
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleToggleIntercept}
          disabled={isToggling}
          icon={<Shield className="h-4 w-4" />}
        >
          {isToggling ? 'Toggling intercept...' : 'Toggle intercept'}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleNewRule} icon={<Plus className="h-4 w-4" />}>
          New rule
        </ContextMenuItem>
      </div>
    ),
    [handleClearSelection, handleNewRule, handleOpenSettings, handleRefresh, handleToggleIntercept, isToggling]
  );

  return (
    <ContextMenu menu={menu} shouldOpen={shouldOpen}>
      {children}
    </ContextMenu>
  );
}
