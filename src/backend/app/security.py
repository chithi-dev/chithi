from pwdlib import PasswordHash

# Initialize with recommended Argon2 settings
password_hash = PasswordHash.recommended()


def get_password_hash(password: str) -> str:
    """Hashes a plain text password."""
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against a hash."""
    return password_hash.verify(plain_password, hashed_password)
