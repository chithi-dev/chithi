from async_typer import AsyncTyper
import os
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

app = AsyncTyper()


key = ChaCha20Poly1305.generate_key()
chacha = ChaCha20Poly1305(key)


nonce = os.urandom(12)


@app.async_command()
async def hello(name: str):
    ciphertext = chacha.encrypt(nonce, f"hello {name}".encode(), None)

    print(ciphertext)
