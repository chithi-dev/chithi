import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import rehypeEmailMangle from './plugins/email-obfuscate';

export async function html_to_markdown(markdown: string) {
	const result = await unified()
		.use(remarkParse)
		.use(remarkRehype) // Markdown → HTML AST
		.use(rehypeEmailMangle) // Obfuscate email addresses
		.use(rehypeSanitize) // Sanitize HTML AST
		.use(rehypeStringify) // HTML AST → string
		.process(markdown);
	return result.toString();
}
