import { Api } from '#consts/backend';
import { fetchJson } from './fetch-utils';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export type RoomOut = { files: Array<{ key: string; filename: string; size: number; created_at: string }>; host_count?: number; connected_hosts?: number; connected_guests?: number };

export function useRoomQuery(room_id: () => string) {
  const qc = useQueryClient();
  const query = createQuery(() => ({
    queryKey: ['reverse-room', room_id()],
    queryFn: () => fetchJson<RoomOut>(Api.REVERSE.ROOM_DETAIL(room_id()), 'room detail'),
    retry: false
  }));
  return { room: query, qc };
}
