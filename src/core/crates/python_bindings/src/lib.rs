use ::chithi_core::chithi_cryto::{
    decrypt_all, decrypt_chunk, decrypt_chunks_parallel, decrypt_record,
    encrypt_all, encrypt_chunk, encrypt_chunks_parallel, encrypt_record,
    get_chunk_nonce, Keychain, sdk_upload, sdk_download,
    bundle_to_json, bundle_from_json,
};
use ::chithi_core::seven::{sdk_compress_and_encrypt, sdk_decrypt_and_decompress, SevenZBackend, SevenZDefault};
use pyo3::prelude::*;
use pyo3::wrap_pyfunction;

// ============================================================================
// SDK-level functions — upload / download
// ============================================================================

/// Upload files: compress into 7z archive + encrypt with password-derived key.
/// All crypto runs in parallel across all CPU cores (GIL is released).
///
/// Args:
///     files: list of (filename: str, data: bytes) tuples
///     password: encryption password
///
/// Returns:
///     bytes — encrypted bundle (salt + base_iv + signature + encrypted_data)
#[pyfunction(name = "upload")]
fn py_upload(files: Vec<(String, Vec<u8>)>, password: String) -> PyResult<Vec<u8>> {
    Python::with_gil(|py| {
        py.allow_threads(|| {
            if files.is_empty() {
                return Err(pyo3::exceptions::PyValueError::new_err(
                    "At least one file is required",
                ));
            }
            if password.is_empty() {
                return Err(pyo3::exceptions::PyValueError::new_err(
                    "Password must not be empty",
                ));
            }
            sdk_compress_and_encrypt(&files, Some(&password), None)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

/// Download: decrypt + decompress bundle back to files.
/// All crypto runs in parallel across all CPU cores (GIL is released).
///
/// Args:
///     bundle: bytes — encrypted bundle from upload()
///     password: encryption password
///
/// Returns:
///     list of (filename: str, data: bytes) tuples
#[pyfunction(name = "download")]
fn py_download(bundle: &[u8], password: String) -> PyResult<Vec<(String, Vec<u8>)>> {
    Python::with_gil(|py| {
        py.allow_threads(|| {
            if password.is_empty() {
                return Err(pyo3::exceptions::PyValueError::new_err(
                    "Password must not be empty",
                ));
            }
            sdk_decrypt_and_decompress(bundle, Some(&password), None)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

/// Upload raw data: encrypt with password-derived key (no compression).
/// Returns JSON-serialized bundle as bytes.
#[pyfunction(name = "upload_data")]
fn py_upload_data(data: &[u8], password: String) -> PyResult<Vec<u8>> {
    Python::with_gil(|py| {
        py.allow_threads(|| {
            if data.is_empty() {
                return Err(pyo3::exceptions::PyValueError::new_err(
                    "Data must not be empty",
                ));
            }
            if password.is_empty() {
                return Err(pyo3::exceptions::PyValueError::new_err(
                    "Password must not be empty",
                ));
            }
            let bundle = sdk_upload(data, &password, None)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
            bundle_to_json(&bundle)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

/// Download raw data: verify + decrypt JSON-serialized bundle.
#[pyfunction(name = "download_data")]
fn py_download_data(bundle_json: &[u8], password: String) -> PyResult<Vec<u8>> {
    Python::with_gil(|py| {
        py.allow_threads(|| {
            if password.is_empty() {
                return Err(pyo3::exceptions::PyValueError::new_err(
                    "Password must not be empty",
                ));
            }
            let bundle = bundle_from_json(bundle_json)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
            sdk_download(&bundle, &password, None)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

// ============================================================================
// 7z compression (low-level)
// ============================================================================

#[pyfunction(name = "compress_7z")]
#[pyo3(signature = (files, password = None))]
fn pi_compress_7z(files: Vec<(String, Vec<u8>)>, password: Option<String>) -> PyResult<Vec<u8>> {
    Python::with_gil(|py| {
        py.allow_threads(|| {
            SevenZDefault::compress(&files, password.as_deref())
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

#[pyfunction(name = "decompress_7z")]
#[pyo3(signature = (data, password = None))]
fn pi_decompress_7z(data: &[u8], password: Option<String>) -> PyResult<Vec<(String, Vec<u8>)>> {
    Python::with_gil(|py| {
        py.allow_threads(|| {
            SevenZDefault::decompress(data, password.as_deref())
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

#[pyfunction(name = "validate_7z")]
fn pi_validate_7z(data: &[u8]) -> PyResult<bool> {
    Ok(SevenZDefault::validate(data))
}

// ============================================================================
// Key derivation
// ============================================================================

#[pyfunction(name = "generate_secret")]
fn pi_generate_secret() -> String {
    let kc = Keychain::new();
    kc.generate_secret()
}

#[pyfunction(name = "generate_ikm")]
fn pi_generate_ikm() -> PyResult<Vec<u8>> {
    use rand::rngs::OsRng;
    use rand::RngCore;
    let mut ikm = [0u8; 32];
    OsRng.fill_bytes(&mut ikm);
    Ok(ikm.to_vec())
}

#[pyfunction(name = "derive_key")]
fn pi_derive_key(password: &[u8], salt: &[u8]) -> PyResult<Vec<u8>> {
    ::chithi_core::derive_key(password, salt)
        .map(|k| k.to_vec())
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

#[pyfunction(name = "argon2_derive")]
#[pyo3(signature = (password, salt, iterations, memory_cost_kib, hash_length))]
fn pi_argon2_derive(
    password: &[u8],
    salt: &[u8],
    iterations: u32,
    memory_cost_kib: u32,
    hash_length: usize,
) -> PyResult<Vec<u8>> {
    let mut out = vec![0u8; hash_length];
    argon2::Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        argon2::Params::new(
            memory_cost_kib,
            iterations,
            1,
            Some(hash_length),
        ).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?,
    ).hash_password_into(password, salt, &mut out)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    Ok(out)
}

// ============================================================================
// Record encryption (AES-256-CBC)
// ============================================================================

#[pyfunction(name = "encrypt_record")]
fn pi_encrypt_record(data: &[u8], key: &[u8]) -> PyResult<Vec<u8>> {
    validate_key(key)?;
    let key_arr: [u8; 32] = key.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;
    encrypt_record(data, &key_arr)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

#[pyfunction(name = "decrypt_record")]
fn pi_decrypt_record(data: &[u8], key: &[u8]) -> PyResult<Vec<u8>> {
    validate_key(key)?;
    let key_arr: [u8; 32] = key.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;
    decrypt_record(data, &key_arr)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

// ============================================================================
// Chunk encryption (AES-256-GCM)
// ============================================================================

#[pyfunction(name = "encrypt_chunk")]
fn pi_encrypt_chunk(data: &[u8], key: &[u8], nonce: &[u8]) -> PyResult<Vec<u8>> {
    validate_key(key)?;
    validate_nonce(nonce)?;
    let key_arr: [u8; 32] = key.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;
    let nonce_arr: [u8; 12] = nonce.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Nonce must be 12 bytes"))?;
    encrypt_chunk(data, &key_arr, &nonce_arr)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

#[pyfunction(name = "decrypt_chunk")]
fn pi_decrypt_chunk(data: &[u8], key: &[u8], nonce: &[u8]) -> PyResult<Vec<u8>> {
    validate_key(key)?;
    validate_nonce(nonce)?;
    let key_arr: [u8; 32] = key.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;
    let nonce_arr: [u8; 12] = nonce.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Nonce must be 12 bytes"))?;
    decrypt_chunk(data, &key_arr, &nonce_arr)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

#[pyfunction(name = "get_chunk_nonce")]
fn pi_get_chunk_nonce(base_iv: &[u8], chunk_index: u32) -> PyResult<Vec<u8>> {
    if base_iv.len() != 12 {
        return Err(pyo3::exceptions::PyValueError::new_err("base_iv must be 12 bytes"));
    }
    let base_arr: [u8; 12] = base_iv.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("base_iv must be 12 bytes"))?;
    Ok(get_chunk_nonce(&base_arr, chunk_index).to_vec())
}

// ============================================================================
// Parallel batch encryption — GIL released for full multi-core utilization
// ============================================================================

#[pyfunction(name = "encrypt_chunks_parallel")]
fn pi_encrypt_chunks_parallel(
    chunks: Vec<Vec<u8>>,
    key: &[u8],
    base_iv: &[u8],
) -> PyResult<Vec<Vec<u8>>> {
    validate_key(key)?;
    if base_iv.len() != 12 {
        return Err(pyo3::exceptions::PyValueError::new_err("base_iv must be 12 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;
    let base_iv_arr: [u8; 12] = base_iv.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("base_iv must be 12 bytes"))?;

    Python::with_gil(|py| {
        py.allow_threads(|| {
            encrypt_chunks_parallel(&chunks, &key_arr, &base_iv_arr, None)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

#[pyfunction(name = "decrypt_chunks_parallel")]
fn pi_decrypt_chunks_parallel(
    chunks: Vec<Vec<u8>>,
    key: &[u8],
    base_iv: &[u8],
) -> PyResult<Vec<Vec<u8>>> {
    validate_key(key)?;
    if base_iv.len() != 12 {
        return Err(pyo3::exceptions::PyValueError::new_err("base_iv must be 12 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;
    let base_iv_arr: [u8; 12] = base_iv.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("base_iv must be 12 bytes"))?;

    Python::with_gil(|py| {
        py.allow_threads(|| {
            decrypt_chunks_parallel(&chunks, &key_arr, &base_iv_arr, None)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

#[pyfunction(name = "encrypt_all")]
fn pi_encrypt_all(records: Vec<Vec<u8>>, key: &[u8]) -> PyResult<Vec<Vec<u8>>> {
    validate_key(key)?;
    let key_arr: [u8; 32] = key.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;

    Python::with_gil(|py| {
        py.allow_threads(|| {
            encrypt_all(&records, &key_arr)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

#[pyfunction(name = "decrypt_all")]
fn pi_decrypt_all(records: Vec<Vec<u8>>, key: &[u8]) -> PyResult<Vec<Vec<u8>>> {
    validate_key(key)?;
    let key_arr: [u8; 32] = key.try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;

    Python::with_gil(|py| {
        py.allow_threads(|| {
            decrypt_all(&records, &key_arr)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
        })
    })
}

// ============================================================================
// Keychain class
// ============================================================================

#[pyclass(name = "Keychain")]
pub struct PyKeychain {
    inner: Keychain,
}

#[pymethods]
impl PyKeychain {
    #[new]
    fn new() -> Self {
        Self {
            inner: Keychain::new(),
        }
    }

    #[classmethod]
    #[pyo3(name = "from_password")]
    fn from_password_py(_cls: &Bound<'_, pyo3::types::PyType>, password: String) -> PyResult<Self> {
        let kc = Keychain::from_password(&password)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(Self { inner: kc })
    }

    #[pyo3(name = "set_password")]
    fn set_password_py(&mut self, password: String) -> PyResult<()> {
        self.inner
            .set_password(&password)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
    }

    #[pyo3(name = "generate_secret")]
    fn generate_secret_py(&self) -> String {
        self.inner.generate_secret()
    }

    #[pyo3(name = "encrypt_metadata")]
    fn encrypt_metadata_py(&self, metadata: String) -> PyResult<Vec<u8>> {
        self.inner
            .encrypt_metadata(&metadata)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
    }

    #[pyo3(name = "decrypt_metadata")]
    fn decrypt_metadata_py(&self, data: &[u8]) -> PyResult<String> {
        self.inner
            .decrypt_metadata(data)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
    }

    #[pyo3(name = "sign")]
    fn sign_py(&self, data: &[u8]) -> Vec<u8> {
        self.inner.sign(data)
    }

    #[pyo3(name = "verify")]
    fn verify_py(&self, data: &[u8], signature: &[u8]) -> bool {
        self.inner.verify(data, signature)
    }

    #[pyo3(name = "export_auth_key")]
    fn export_auth_key_py(&self) -> Vec<u8> {
        self.inner.export_auth_key().to_vec()
    }

    #[pyo3(name = "salt")]
    fn salt_py(&self) -> Vec<u8> {
        self.inner.salt().to_vec()
    }

    #[pyo3(name = "ikm")]
    fn ikm_py(&self) -> Vec<u8> {
        self.inner.ikm().to_vec()
    }
}

// ============================================================================
// Helpers
// ============================================================================

fn validate_key(key: &[u8]) -> PyResult<()> {
    if key.len() != 32 {
        return Err(pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"));
    }
    Ok(())
}

fn validate_nonce(nonce: &[u8]) -> PyResult<()> {
    if nonce.len() != 12 {
        return Err(pyo3::exceptions::PyValueError::new_err("Nonce must be 12 bytes"));
    }
    Ok(())
}

// ============================================================================
// Module definition
// ============================================================================

#[pymodule]
fn chithi_core(py: Python<'_>, m: &Bound<'_, pyo3::types::PyModule>) -> PyResult<()> {
    // SDK-level
    m.add_function(wrap_pyfunction!(py_upload)(py)?)?;
    m.add_function(wrap_pyfunction!(py_download)(py)?)?;
    m.add_function(wrap_pyfunction!(py_upload_data)(py)?)?;
    m.add_function(wrap_pyfunction!(py_download_data)(py)?)?;

    // 7z compression
    m.add_function(wrap_pyfunction!(pi_compress_7z)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_decompress_7z)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_validate_7z)(py)?)?;

    // Key derivation
    m.add_function(wrap_pyfunction!(pi_generate_secret)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_generate_ikm)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_derive_key)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_argon2_derive)(py)?)?;

    // Record encryption
    m.add_function(wrap_pyfunction!(pi_encrypt_record)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_decrypt_record)(py)?)?;

    // Chunk encryption
    m.add_function(wrap_pyfunction!(pi_encrypt_chunk)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_decrypt_chunk)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_get_chunk_nonce)(py)?)?;

    // Parallel batch
    m.add_function(wrap_pyfunction!(pi_encrypt_chunks_parallel)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_decrypt_chunks_parallel)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_encrypt_all)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_decrypt_all)(py)?)?;

    // Keychain
    m.add_class::<PyKeychain>()?;

    Ok(())
}
