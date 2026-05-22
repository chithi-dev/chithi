import rehypeEmailMangle from './plugins/email-obfuscate';

const { unified } = await import('unified');
const { default: remarkParse } = await import('remark-parse');
const { default: remarkRehype } = await import('remark-rehype');
const { default: rehypeSanitize } = await import('rehype-sanitize');
const { default: rehypeStringify } = await import('rehype-stringify');

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
