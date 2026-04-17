<script lang="ts">
	import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view';
	import { EditorState, Compartment } from '@codemirror/state';
	import {
		LanguageDescription,
		syntaxHighlighting,
		HighlightStyle,
		bracketMatching,
		foldGutter
	} from '@codemirror/language';
	import { tags } from '@lezer/highlight';
	import { languages } from '@codemirror/language-data';
	import { onDestroy } from 'svelte';

	let { text, filename } = $props<{
		text: string;
		filename: string;
	}>();

	let container: HTMLDivElement;
	let view: EditorView | undefined;
	const langCompartment = new Compartment();

	// Material Ocean palette
	const bg = '#0F111A';
	const fg = '#A6ACCD';
	const gutterBg = '#0F111A';
	const gutterFg = '#3B3F51';
	const lineHL = '#1a1c25';
	const selection = '#1F2233';
	const matchBracket = '#1F2233';
	const purple = '#C792EA';
	const green = '#C3E88D';
	const orange = '#F78C6C';
	const blue = '#82AAFF';
	const yellow = '#FFCB6B';
	const cyan = '#89DDFF';
	const red = '#F07178';
	const comment = '#464B5D';

	const materialOceanTheme = EditorView.theme(
		{
			'&': {
				height: '100%',
				fontSize: '13px',
				backgroundColor: bg,
				color: fg
			},
			'.cm-scroller': {
				fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
				lineHeight: '1.6',
				overflow: 'auto'
			},
			'.cm-gutters': {
				backgroundColor: gutterBg,
				color: gutterFg,
				borderRight: '1px solid #1a1c25',
				minWidth: '3.5rem'
			},
			'.cm-lineNumbers .cm-gutterElement': {
				padding: '0 8px 0 12px',
				fontSize: '12px'
			},
			'.cm-foldGutter .cm-gutterElement': {
				padding: '0 4px',
				color: gutterFg
			},
			'.cm-activeLine': {
				backgroundColor: lineHL
			},
			'.cm-activeLineGutter': {
				backgroundColor: lineHL,
				color: fg
			},
			'.cm-content': {
				padding: '4px 0',
				caretColor: yellow
			},
			'.cm-line': {
				padding: '0 16px 0 8px'
			},
			'.cm-cursor': {
				borderLeftColor: yellow
			},
			'.cm-selectionBackground': {
				backgroundColor: selection + ' !important'
			},
			'&.cm-focused .cm-selectionBackground': {
				backgroundColor: '#2B2F40 !important'
			},
			'.cm-matchingBracket': {
				backgroundColor: matchBracket,
				outline: `1px solid ${gutterFg}`
			},
			'.cm-selectionMatch': {
				backgroundColor: '#2B2F40'
			}
		},
		{ dark: true }
	);

	const materialOceanHighlight = HighlightStyle.define([
		{ tag: tags.keyword, color: purple },
		{ tag: tags.controlKeyword, color: purple },
		{ tag: tags.operatorKeyword, color: cyan },
		{ tag: tags.operator, color: cyan },
		{ tag: tags.separator, color: cyan },
		{ tag: tags.punctuation, color: cyan },
		{ tag: tags.bracket, color: cyan },
		{ tag: tags.angleBracket, color: cyan },
		{ tag: tags.string, color: green },
		{ tag: tags.special(tags.string), color: green },
		{ tag: tags.regexp, color: green },
		{ tag: tags.number, color: orange },
		{ tag: tags.integer, color: orange },
		{ tag: tags.float, color: orange },
		{ tag: tags.bool, color: orange },
		{ tag: tags.null, color: orange },
		{ tag: tags.function(tags.variableName), color: blue },
		{ tag: tags.function(tags.propertyName), color: blue },
		{ tag: tags.definition(tags.function(tags.variableName)), color: blue },
		{ tag: tags.typeName, color: yellow },
		{ tag: tags.className, color: yellow },
		{ tag: tags.definition(tags.typeName), color: yellow },
		{ tag: tags.tagName, color: red },
		{ tag: tags.attributeName, color: purple },
		{ tag: tags.attributeValue, color: green },
		{ tag: tags.propertyName, color: '#B2CCD6' },
		{ tag: tags.variableName, color: fg },
		{ tag: tags.definition(tags.variableName), color: fg },
		{ tag: tags.self, color: red },
		{ tag: tags.comment, color: comment, fontStyle: 'italic' },
		{ tag: tags.blockComment, color: comment, fontStyle: 'italic' },
		{ tag: tags.lineComment, color: comment, fontStyle: 'italic' },
		{ tag: tags.docComment, color: comment, fontStyle: 'italic' },
		{ tag: tags.meta, color: '#717CB4' },
		{ tag: tags.processingInstruction, color: '#717CB4' },
		{ tag: tags.heading, color: yellow, fontWeight: 'bold' },
		{ tag: tags.strong, fontWeight: 'bold' },
		{ tag: tags.emphasis, fontStyle: 'italic' },
		{ tag: tags.link, color: cyan, textDecoration: 'underline' },
		{ tag: tags.invalid, color: red }
	]);

	$effect(() => {
		if (!container) return;

		view?.destroy();

		const state = EditorState.create({
			doc: text,
			extensions: [
				lineNumbers(),
				foldGutter(),
				bracketMatching(),
				highlightActiveLine(),
				syntaxHighlighting(materialOceanHighlight),
				EditorState.readOnly.of(true),
				EditorView.editable.of(false),
				materialOceanTheme,
				langCompartment.of([])
			]
		});

		view = new EditorView({ state, parent: container });

		const langDesc = LanguageDescription.matchFilename(languages, filename);
		if (langDesc) {
			langDesc.load().then((lang) => {
				view?.dispatch({
					effects: langCompartment.reconfigure(lang)
				});
			});
		}
	});

	onDestroy(() => {
		view?.destroy();
	});
</script>

<div class="h-full overflow-hidden [&_.cm-editor]:h-full" bind:this={container}></div>
