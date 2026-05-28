import type { RoomCreateResult, HostTokenResult } from '../types';
import { gqlFetch } from '../client';

export const CREATE_ROOM_MUTATION = `
	mutation CreateRoom($input: RoomCreateInput!) {
		createRoom(input: $input) {
			id
			name
			createdAt
			expiresAt
			expireAfter
			number_of_downloads
			hostToken
		}
	}
`;

export const DELETE_ROOM_MUTATION = `
	mutation DeleteRoom($id: ID!, $hostToken: String!) {
		deleteRoom(id: $id, hostToken: $hostToken)
	}
`;

export const ADD_HOST_MUTATION = `
	mutation AddHost($id: ID!, $hostToken: String!) {
		addHost(id: $id, hostToken: $hostToken) {
			hostToken
		}
	}
`;

export async function createRoom(name: string, expireAfter: number, numberOfDownloads?: number): Promise<Partial<RoomCreateResult>> {
	return gqlFetch<Partial<RoomCreateResult>>(CREATE_ROOM_MUTATION, { input: { name, expire_after: expireAfter, number_of_downloads: numberOfDownloads } });
}

export async function deleteRoom(id: string, hostToken: string): Promise<boolean> {
	return gqlFetch<{ deleteRoom: boolean }>(DELETE_ROOM_MUTATION, { id, hostToken }).then((d) => d.deleteRoom);
}
