// Inspired by : https://github.com/markedjs/marked-mangle/blob/9484ff1fe551b8b8bef497a360890225943ace82/src/index
import type { Element, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const mangleEmail = (email: string) =>
	email.split('').map((c) => `&#${c.charCodeAt(0)};`).join('');

const rehypeEmailMangle: Plugin<[], Root> = () => (tree: Root) => {
	visit(tree, 'text', (node: Text) => {
		node.value = node.value.replace(
			/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
			(_match: string, email: string) => mangleEmail(email)
		);
	});

	visit(tree, 'element', (node: Element) => {
		const href = node.properties?.href;
		if (typeof href === 'string' && href.startsWith('mailto:')) {
			node.properties.href = `mailto:${mangleEmail(href.slice(7))}`;
		}
	});

	return tree;
};

export default rehypeEmailMangle;
