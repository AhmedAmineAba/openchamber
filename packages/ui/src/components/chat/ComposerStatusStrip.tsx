import React from 'react';
import { Icon } from '@/components/icon/Icon';
import type { IconName } from '@/components/icon/icons';
import { useWaitingBlink } from '@/hooks/useDurationTicker';
import { cn } from '@/lib/utils';

interface ComposerStatusStripProps {
  icon: IconName;
  /** A blinking icon says the wait is active work, not a pause. */
  blink?: boolean;
  text: string;
}

/**
 * A quiet status line among the composer's top rows, for a wait the first
 * prompt depends on: a worktree running its setup commands, a message waiting
 * for its space. It says why nothing happens yet, so the wait does not look
 * stuck; it offers no action.
 */
export const ComposerStatusStrip: React.FC<ComposerStatusStripProps> = React.memo(({ icon, blink = false, text }) => {
  const blinkClass = useWaitingBlink(blink);
  return (
    <div role="status" className="border-b border-border/60">
      <div className="flex h-10 items-center gap-2 ps-3 pe-3">
        <Icon name={icon} className={cn('size-3.5 shrink-0 text-muted-foreground', blinkClass)} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate typography-meta text-muted-foreground">{text}</span>
      </div>
    </div>
  );
});

ComposerStatusStrip.displayName = 'ComposerStatusStrip';
