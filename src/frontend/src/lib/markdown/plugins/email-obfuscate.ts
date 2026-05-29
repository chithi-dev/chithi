import type { Element, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

function mangle(str: string) {
  return str.split('').map(c => `&#${c.charCodeAt(0)};`).join('');
}

const rehypeEmailMangle: Plugin<[], Root> = () => tree => {
  visit(tree, 'text', (node: Text) => {
    node.value = node.value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, mangle);
  });
  visit(tree, 'element', (node: Element) => {
    if (node.tagName === 'a' && typeof node.properties?.href === 'string' && node.properties.href.startsWith('mailto:')) {
      node.properties.href = 'mailto:' + mangle(node.properties.href.slice(7));
    }
  });
  return tree;
};

export default rehypeEmailMangle;
