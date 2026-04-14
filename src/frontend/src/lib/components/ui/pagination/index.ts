import Content from './pagination-content.svelte';
import Ellipsis from './pagination-ellipsis.svelte';
import Item from './pagination-item.svelte';
import Link from './pagination-link.svelte';
import NextButton from './pagination-next-button.svelte';
import Next from './pagination-next.svelte';
import PrevButton from './pagination-prev-button.svelte';
import Previous from './pagination-previous.svelte';
import Root from './pagination.svelte';

export {
	Content, // old
	Ellipsis,
	Item,
	Link,
	Next, // old
	NextButton,
	//
	Root as Pagination,
	Content as PaginationContent, // old
	Ellipsis as PaginationEllipsis,
	Item as PaginationItem,
	Link as PaginationLink,
	Next as PaginationNext, // old
	NextButton as PaginationNextButton,
	PrevButton as PaginationPrevButton,
	Previous as PaginationPrevious,
	PrevButton,
	Previous,
	Root
};
