let _token = $state<null | string>(null);

export const token_store = {
	set token(token: string | null) {
		_token = token;
	},
	get token(): string | null {
		return _token;
	}
};
