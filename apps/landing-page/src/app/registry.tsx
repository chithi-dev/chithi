"use client";
import { useServerInsertedHTML } from "next/navigation";

import React, { useState } from "react";
import { createStyleRegistry, StyleRegistry } from "styled-jsx";

export default function StyledJsxRegistry({
	children,
}: {
	children: React.ReactNode;
}) {
	// Only create stylesheet once with lazy initial state
	// x-ref: https://reactjs.org/docs/hooks-reference.html#lazy-initial-state
	const [jsxStyleRegistry] = useState(() => createStyleRegistry());

	useServerInsertedHTML(() => {
		const styles = jsxStyleRegistry.styles();
		jsxStyleRegistry.flush();
		return <>{styles}</>;
	});

	return <StyleRegistry registry={jsxStyleRegistry}>{children}</StyleRegistry>;
}
