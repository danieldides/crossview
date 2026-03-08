import {createTheme} from 'thememirror';
import {tags as t} from '@lezer/highlight';

const crossviewMirrorTheme = createTheme({
	variant: 'dark',
	settings: {
		background: '#201f23',
		foreground: '#4d6276',
		caret: '#7c3aed',
		selection: '#2a282f',
		lineHighlight: '#8a91991a',
		gutterBackground: '#2e2d32',
		gutterForeground: '#8a919966',
	},
	styles: [
		{
			tag: t.propertyName,
			color: '#3f75ab',
		},
		{
			tag: t.comment,
			color: '#787b8099',
		},
		{
			tag: t.variableName,
			color: '#5c6166',
		},
		{
			tag: [t.string, t.special(t.brace)],
			color: '#5c6166',
		},
		{
			tag: t.number,
			color: '#5c6166',
		},
		{
			tag: t.bool,
			color: '#5c6166',
		},
		{
			tag: t.null,
			color: '#5c6166',
		},
		{
			tag: t.keyword,
			color: '#62665c',
		},
		{
			tag: t.operator,
			color: '#62665c',
		},
		{
			tag: t.className,
			color: '#5c665f',
		},
		{
			tag: t.definition(t.typeName),
			color: '#5e665c',
		},
		{
			tag: t.typeName,
			color: '#5c6166',
		},
		{
			tag: t.angleBracket,
			color: '#5c6166',
		},
		{
			tag: t.tagName,
			color: '#5c6166',
		},
		{
			tag: t.attributeName,
			color: '#5c6166',
		},
	],
});
export {crossviewMirrorTheme};