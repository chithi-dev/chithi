let authenticated = $state<null | boolean>(null);

export const user_store = {
	unauthenticate() {
		authenticated = false;
	},
	authenticate() {
		authenticated = true;
	},
	get is_authenticated() {
		return authenticated;
	}
};
