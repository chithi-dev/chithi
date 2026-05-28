import type { RoomOut, RoomFileEntry } from '../types';
import { gqlFetch } from '../client';

export const GET_ROOM = `
	query GetRoom($id: ID!) {
		room(id: $id) {
			id
			name
			createdAt
			expiresAt
			expireAfter
			number_of_downloads
			files {
				key
				filename
				size
				uploaded_at
			}
		}
	}
`;

export const GET_ROOMS = `
	query GetRooms {
		rooms {
			id
			name
			createdAt
			expiresAt
			expireAfter
			number_of_downloads
			files {
				key
				filename
				size
				uploaded_at
			}
		}
	}
`;

export async function getRoom(id: string): Promise<RoomOut | null> {
	return gqlFetch<Partial<RoomOut>>(GET_ROOM, { id });
}

export async function getRooms(): Promise<{ rooms: RoomOut[] }> {
	return gqlFetch<{ rooms: RoomOut[] }>(GET_ROOMS);
}
