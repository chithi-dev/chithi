let authenticated: null | boolean = null;

export const user_store = () => {
	return {
		authenticate() {
			authenticated = true;
		},
		get is_authenticated() {
			return authenticated;
		}
	};
};
