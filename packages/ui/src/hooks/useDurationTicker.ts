// Shared wall-clock ticker for live duration readouts (tool runtimes, session
// activity counters) and waiting indicators. Subscribers of the same interval
// share one timer and one `now`, so N live rows cost one interval rather than
// N, and everything on the 1 s tick changes in the same frame.

import React from 'react';

type Subscriber = (now: number, tick: number) => void;

type TickerChannel = {
    subscribers: Set<Subscriber>;
    timerId: number | null;
    tick: number;
};

const tickerChannels = new Map<number, TickerChannel>();

const getTickerChannel = (intervalMs: number): TickerChannel => {
    const existing = tickerChannels.get(intervalMs);
    if (existing) {
        return existing;
    }

    const created: TickerChannel = {
        subscribers: new Set<Subscriber>(),
        timerId: null,
        tick: 0,
    };
    tickerChannels.set(intervalMs, created);
    return created;
};

const subscribeToTicker = (intervalMs: number, subscriber: Subscriber): (() => void) => {
    const channel = getTickerChannel(intervalMs);
    channel.subscribers.add(subscriber);
    subscriber(Date.now(), channel.tick);

    if (channel.timerId === null && typeof window !== 'undefined') {
        channel.timerId = window.setInterval(() => {
            const now = Date.now();
            channel.tick += 1;
            channel.subscribers.forEach((listener) => {
                listener(now, channel.tick);
            });
        }, intervalMs);
    }

    return () => {
        const tracked = tickerChannels.get(intervalMs);
        if (!tracked) {
            return;
        }

        tracked.subscribers.delete(subscriber);
        if (tracked.subscribers.size > 0) {
            return;
        }

        if (tracked.timerId !== null && typeof window !== 'undefined') {
            window.clearInterval(tracked.timerId);
        }
        tickerChannels.delete(intervalMs);
    };
};

export const useDurationTickerNow = (active: boolean, intervalMs: number = 250): number => {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!active) {
            return;
        }

        return subscribeToTicker(intervalMs, setNow);
    }, [active, intervalMs]);

    return now;
};

const WAITING_BLINK_INTERVAL_MS = 1000;

/**
 * Bright/dim phase for an indicator of a real wait (connecting, agent working,
 * setup running). It returns `waiting-dim` on every other tick of the shared
 * 1 s ticker, so every waiting indicator on screen toggles in step and the
 * page draws one frame a second for all of them. An infinite CSS animation
 * draws sixty, however few of its frames change. Steady states (connected,
 * error, a long-running action) stay still and never call this.
 */
export const useWaitingBlink = (active: boolean): string | undefined => {
    const [dim, setDim] = React.useState(false);

    React.useEffect(() => {
        if (!active) {
            return;
        }

        return subscribeToTicker(WAITING_BLINK_INTERVAL_MS, (_now, tick) => {
            setDim(tick % 2 === 1);
        });
    }, [active]);

    return active && dim ? 'waiting-dim' : undefined;
};
