import HomeClient from "./page.client";
export default async function Page() {
	let release = null;
	try {
		const res = await fetch(
			"https://api.github.com/repos/chithi-dev/chithi/releases/latest",
			{ next: { revalidate: 3600 } },
		);
		if (res.ok) release = await res.json();
	} catch {
		release = null;
	}

	return <HomeClient release={release} />;
}
