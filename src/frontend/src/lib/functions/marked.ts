import { marked } from 'marked';
import { FilterXSS, type IFilterXSSOptions } from 'xss';

/**
 * Create a marked plugin that sanitizes token content and any raw HTML
 * using the `xss` library (FilterXSS).
 */
export function xssPlugin(options?: IFilterXSSOptions) {
	const filter = new FilterXSS(options);

	return {
		walkTokens(token: any) {
			if (!token) return;

			// Sanitize raw HTML blocks
			if (token.type === 'html') {
				token.text = filter.process(String(token.text || ''));
				token.raw = token.text;
				return;
			}

			// Sanitize common text-bearing tokens
			if (typeof token.text === 'string') {
				token.text = filter.process(token.text);
			}

			// Sanitize link hrefs/titles and image src/titles where present
			if (token.type === 'link' && token.href) token.href = filter.process(token.href);
			if (token.type === 'image' && token.href) token.href = filter.process(token.href);
			if (token.title) token.title = filter.process(token.title);
		},

		renderer: {
			// Sanitize any raw HTML output from the renderer; accept either a raw string or a token object
			html(this: any, htmlOrToken?: any) {
				const raw =
					typeof htmlOrToken === 'string'
						? htmlOrToken
						: String(htmlOrToken?.raw ?? htmlOrToken?.text ?? '');
				return filter.process(String(raw ?? ''));
			}
		}
	};
}

// Register plugin with conservative defaults that strip <script> bodies
marked.use(xssPlugin({ stripIgnoreTag: true, stripIgnoreTagBody: ['<script>'] }));

export { marked };
