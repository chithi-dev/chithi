// Inspired by : https://github.com/markedjs/marked-mangle/blob/9484ff1fe551b8b8bef497a360890225943ace82/src/index.js
import type { Element, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Rehype plugin to obfuscate email addresses
 */
const rehypeEmailMangle: Plugin<[], Root> = () => {
	return (tree: Root) => {
		// Visit text nodes only
		visit(tree, 'text', (node: Text) => {
			node.value = node.value.replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, (email) =>
				email
					.split('')
					.map((c) => `&#${c.charCodeAt(0)};`)
					.join('')
			);
		});

		// Visit element nodes only
		visit(tree, 'element', (node: Element) => {
			if (node.tagName === 'a' && node.properties?.href) {
				const href = node.properties.href;
				if (typeof href === 'string' && href.startsWith('mailto:')) {
					const email = href.slice(7);
					node.properties.href = `mailto:${email
						.split('')
						.map((c) => `&#${c.charCodeAt(0)};`)
						.join('')}`;
				}
			}
		});

		return tree;
	};
};

export default rehypeEmailMangle;
