import { ImageResponse } from '@ethercorps/sveltekit-og';
import type { RequestHandler } from '@sveltejs/kit';
import OpenGraphComponent from './OpenGraph.svelte';

export const GET: RequestHandler = async () => {
	return new ImageResponse(OpenGraphComponent, {
		width: 1200,
		height: 630
	});
};
