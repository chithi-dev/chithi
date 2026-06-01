let authenticated = $state<null | boolean>(null);

export let user_store = $state({
	get is_authenticated() {
		return authenticated;
	},
	unauthenticate() {
		authenticated = false;
	},
	authenticate() {
		authenticated = true;
	}
});
