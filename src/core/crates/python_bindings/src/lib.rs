use chithi_core::send_crypto::{decrypt_record, encrypt_record, Keychain};
use chithi_core::seven::{SevenZBackend, SevenZDefault};
use pyo3::prelude::*;
use pyo3::wrap_pyfunction;

/// Compress files into a 7z archive with optional AES-256 encryption.
#[pyfunction(name = "compress_7z")]
#[pyo3(signature = (files, password = None))]
fn pi_compress_7z(files: Vec<(String, Vec<u8>)>, password: Option<String>) -> PyResult<Vec<u8>> {
    SevenZDefault::compress(&files, password.as_deref())
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

/// Decompress a 7z archive with optional password for encrypted archives.
#[pyfunction(name = "decompress_7z")]
#[pyo3(signature = (data, password = None))]
fn pi_decompress_7z(data: &[u8], password: Option<String>) -> PyResult<Vec<(String, Vec<u8>)>> {
    SevenZDefault::decompress(data, password.as_deref())
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

/// Validate that the given bytes are a 7z archive.
#[pyfunction(name = "validate_7z")]
fn pi_validate_7z(data: &[u8]) -> PyResult<bool> {
    Ok(SevenZDefault::validate(data))
}

/// Generate a random secret (base64-encoded).
#[pyfunction(name = "generate_secret")]
fn pi_generate_secret() -> String {
    let kc = Keychain::new();
    kc.generate_secret()
}

/// Derive a 32-byte key from password and salt using Argon2id + HKDF.
#[pyfunction(name = "derive_key")]
fn pi_derive_key(password: &[u8], salt: &[u8]) -> PyResult<Vec<u8>> {
    chithi_core::send_crypto::derive_key(password, salt)
        .map(|k| k.to_vec())
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

/// Encrypt a single record using AES-256-CBC.
#[pyfunction(name = "encrypt_record")]
fn pi_encrypt_record(data: &[u8], key: &[u8]) -> PyResult<Vec<u8>> {
    if key.len() != 32 {
        return Err(pyo3::exceptions::PyValueError::new_err(
            "Key must be 32 bytes",
        ));
    }
    let key_arr: [u8; 32] = key
        .try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;
    encrypt_record(data, &key_arr).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

/// Decrypt a single record using AES-256-CBC.
#[pyfunction(name = "decrypt_record")]
fn pi_decrypt_record(data: &[u8], key: &[u8]) -> PyResult<Vec<u8>> {
    if key.len() != 32 {
        return Err(pyo3::exceptions::PyValueError::new_err(
            "Key must be 32 bytes",
        ));
    }
    let key_arr: [u8; 32] = key
        .try_into()
        .map_err(|_| pyo3::exceptions::PyValueError::new_err("Key must be 32 bytes"))?;
    decrypt_record(data, &key_arr).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

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
    fn from_password(_cls: &Bound<'_, pyo3::types::PyType>, password: String) -> PyResult<Self> {
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

#[pymodule]
fn python_binding(py: Python<'_>, m: &Bound<'_, pyo3::types::PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(pi_compress_7z)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_decompress_7z)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_validate_7z)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_generate_secret)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_derive_key)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_encrypt_record)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_decrypt_record)(py)?)?;
    m.add_class::<PyKeychain>()?;
    Ok(())
}
