import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Arena {
    id: string;
    title: string;
    description: string;
    createdBy: string;
    roomCode: string;
    isPublic: boolean;
    maxParticipants: number;
    status: 'scheduled' | 'live' | 'completed' | 'cancelled';
    scheduledStartTime: string;
    actualStartTime?: string;
    endTime?: string;
    durationMinutes: number;
    questionFilters: any;
    questionIds: string[];
    totalQuestions: number;
    participantCount: number;
    submissionCount: number;
}

export interface ArenaParticipant {
    id: string;
    arenaId: string;
    userId: string;
    userName?: string;
    joinedAt: string;
    startedAt?: string;
    submittedAt?: string;
    answers: Record<string, any>;
    score: number;
    correctCount: number;
    incorrectCount: number;
    timeTakenSeconds?: number;
    rank?: number;
    isHost: boolean;
    hasViewedSolutions: boolean;
    canViewLeaderboard: boolean;
}

/**
 * Real-time Arena Service using Supabase Realtime
 * No polling - pure WebSocket updates
 */
export class ArenaRealtimeService {
    private supabase = createClient();
    private channels: Map<string, RealtimeChannel> = new Map();

    /**
     * Subscribe to arena updates
     */
    subscribeToArena(
        arenaId: string,
        callbacks: {
            onArenaUpdate?: (arena: Arena) => void;
            onParticipantJoin?: (participant: ArenaParticipant) => void;
            onParticipantUpdate?: (participant: ArenaParticipant) => void;
            onParticipantLeave?: (participantId: string) => void;
            onStatusChange?: (status: string) => void;
        }
    ): RealtimeChannel {
        // Check if already subscribed
        if (this.channels.has(arenaId)) {
            return this.channels.get(arenaId)!;
        }

        const channel = this.supabase
            .channel(`arena:${arenaId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'arenas',
                    filter: `id=eq.${arenaId}`,
                },
                (payload) => {
                    const arena = payload.new as any;
                    if (callbacks.onArenaUpdate) {
                        callbacks.onArenaUpdate(arena);
                    }
                    if (callbacks.onStatusChange && arena.status) {
                        callbacks.onStatusChange(arena.status);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'arena_participants',
                    filter: `arena_id=eq.${arenaId}`,
                },
                (payload) => {
                    if (callbacks.onParticipantJoin) {
                        callbacks.onParticipantJoin(payload.new as any);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'arena_participants',
                    filter: `arena_id=eq.${arenaId}`,
                },
                (payload) => {
                    if (callbacks.onParticipantUpdate) {
                        callbacks.onParticipantUpdate(payload.new as any);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'arena_participants',
                    filter: `arena_id=eq.${arenaId}`,
                },
                (payload) => {
                    if (callbacks.onParticipantLeave) {
                        callbacks.onParticipantLeave(payload.old.id);
                    }
                }
            )
            .subscribe();

        this.channels.set(arenaId, channel);
        return channel;
    }

    /**
     * Unsubscribe from arena
     */
    unsubscribeFromArena(arenaId: string) {
        const channel = this.channels.get(arenaId);
        if (channel) {
            this.supabase.removeChannel(channel);
            this.channels.delete(arenaId);
        }
    }

    /**
     * Unsubscribe from all arenas
     */
    unsubscribeAll() {
        this.channels.forEach((channel) => {
            this.supabase.removeChannel(channel);
        });
        this.channels.clear();
    }

    /**
     * Subscribe to arena list updates (for lobby)
     */
    subscribeToArenaList(
        callbacks: {
            onArenaCreated?: (arena: Arena) => void;
            onArenaUpdated?: (arena: Arena) => void;
            onArenaDeleted?: (arenaId: string) => void;
        }
    ): RealtimeChannel {
        const channel = this.supabase
            .channel('arena_list')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'arenas',
                },
                (payload) => {
                    if (callbacks.onArenaCreated) {
                        callbacks.onArenaCreated(payload.new as any);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'arenas',
                },
                (payload) => {
                    if (callbacks.onArenaUpdated) {
                        callbacks.onArenaUpdated(payload.new as any);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'arenas',
                },
                (payload) => {
                    if (callbacks.onArenaDeleted) {
                        callbacks.onArenaDeleted(payload.old.id);
                    }
                }
            )
            .subscribe();

        this.channels.set('arena_list', channel);
        return channel;
    }

    /**
     * Broadcast presence (who's online in arena)
     */
    async joinArenaPresence(arenaId: string, userId: string, userName: string) {
        const channel = this.channels.get(arenaId);
        if (!channel) {
            throw new Error('Not subscribed to arena');
        }

        await channel.track({
            user_id: userId,
            user_name: userName,
            online_at: new Date().toISOString(),
        });
    }

    /**
     * Listen to presence changes
     */
    onPresenceSync(arenaId: string, callback: (state: any) => void) {
        const channel = this.channels.get(arenaId);
        if (!channel) return;

        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            callback(state);
        });
    }
}

// Singleton instance
let arenaRealtimeService: ArenaRealtimeService;

export function getArenaRealtimeService(): ArenaRealtimeService {
    if (!arenaRealtimeService) {
        arenaRealtimeService = new ArenaRealtimeService();
    }
    return arenaRealtimeService;
}
