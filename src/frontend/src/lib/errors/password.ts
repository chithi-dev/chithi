export class PasswordRequiredError extends Error {
	constructor() {
		super('Password required for decryption');
		this.name = 'PasswordRequiredError';
	}
}
