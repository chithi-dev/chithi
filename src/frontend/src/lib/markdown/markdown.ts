import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import strip from 'strip-markdown';
import { unified } from 'unified';
import rehypeEmailMangle from './plugins/email-obfuscate';

export async function markdown_to_html(markdown: string) {
	const result = await unified()
		.use(remarkParse)
		.use(remarkRehype) // Markdown → HTML AST
		.use(rehypeEmailMangle) // Obfuscate email addresses
		.use(rehypeSanitize) // Sanitize HTML AST
		.use(rehypeStringify) // HTML AST → string
		.process(markdown);
	return result.toString();
}

export async function markdown_to_text(markdown: string) {
	const result = await unified()
		.use(remarkParse) // parse markdown
		.use(strip) // strip markdown formatting, get plain text
		.process(markdown);

	return result.toString();
}
