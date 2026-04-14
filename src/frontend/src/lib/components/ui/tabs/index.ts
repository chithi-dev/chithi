import Content from './tabs-content.svelte';
import List, { tabsListVariants, type TabsListVariant } from './tabs-list.svelte';
import Trigger from './tabs-trigger.svelte';
import Root from './tabs.svelte';

export {
	Content,
	List,
	Root,
	//
	Root as Tabs,
	Content as TabsContent,
	List as TabsList,
	tabsListVariants,
	Trigger as TabsTrigger,
	Trigger,
	type TabsListVariant
};
