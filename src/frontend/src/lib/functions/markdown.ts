import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

export function html_to_markdown(markdown: string) {
	const result = unified()
		.use(remarkParse)
		.use(remarkRehype) // Markdown → HTML AST
		.use(rehypeSanitize) // Sanitize HTML AST
		.use(rehypeStringify) // HTML AST → string
		.processSync(markdown);
	return result.toString();
}
