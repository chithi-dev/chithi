import "@scalar/api-reference-react/style.css";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import { OPENAPI_SERVER, OPENAPI_URL } from "@/consts/urls";

export default async function References() {
	const res = await fetch(OPENAPI_URL, { next: { revalidate: 3600 } });

	if (!res.ok) {
		throw new Error(`Failed to fetch OpenAPI spec: ${res.status}`);
	}

	const contents = await res.json();

	return (
		<ApiReferenceReact
			configuration={{
				content: contents,
				servers: [
					{
						url: OPENAPI_SERVER,
						description: "Production Server",
					},
				],
			}}
		/>
	);
}
