import React from 'react';
import { useWaitingBlink } from '@/hooks/useDurationTicker';
import { cn } from '@/lib/utils';

interface BusyDotsProps {
  className?: string;
}

/**
 * Three dots after a label for as long as the model thinks or a connection is
 * made. They blink together on the shared 1 s waiting tick; a staggered CSS
 * wave drew five frames a second and cost about 4.7% of a core on a still page.
 */
export const BusyDots: React.FC<BusyDotsProps> = ({ className }) => {
  const blink = useWaitingBlink(true);
  return (
    <>
      {' '}
      <span data-busy-dots="" className={cn('inline-flex', blink, className)} aria-hidden="true">
        ...
      </span>
    </>
  );
};
