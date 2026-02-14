'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ContextMenuProps {
  children: React.ReactNode;
  menu: React.ReactNode;
  shouldOpen?: (e: React.MouseEvent) => boolean;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
}

export function ContextMenu({ children, menu, shouldOpen }: ContextMenuProps) {
  const [state, setState] = React.useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const menuRef = React.useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (shouldOpen && !shouldOpen(e)) {
      return;
    }

    e.preventDefault();

    // Calculate position, ensuring menu stays within viewport
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 300);

    setState({ isOpen: true, x, y });
  };

  const handleClose = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (state.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [state.isOpen]);

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>
      {state.isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] rounded-md border border-border bg-card p-1 shadow-lg"
          style={{ left: state.x, top: state.y }}
          onClick={handleClose}
        >
          {menu}
        </div>
      )}
    </>
  );
}

interface ContextMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: React.ReactNode;
}

export function ContextMenuItem({
  children,
  onClick,
  disabled = false,
  destructive = false,
  icon,
}: ContextMenuItemProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:bg-accent hover:text-accent-foreground',
        destructive && !disabled && 'text-red-500 hover:bg-red-500/10 hover:text-red-500'
      )}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

export function ContextMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
      {children}
    </div>
  );
}
