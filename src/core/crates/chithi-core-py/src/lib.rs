use pyo3::prelude::*;
use pyo3::wrap_pyfunction;

/// Compress files into a 7z archive with optional AES-256 encryption.
#[pyfunction(name = "compress_7z")]
#[pyo3(signature = (files, password = None))]
fn pi_compress_7z(
    files: Vec<(String, Vec<u8>)>,
    password: Option<String>,
) -> PyResult<Vec<u8>> {
    ::chithi_core::seven::compress(&files, password.as_deref())
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

/// Decompress a 7z archive with optional password for encrypted archives.
#[pyfunction(name = "decompress_7z")]
#[pyo3(signature = (data, password = None))]
fn pi_decompress_7z(
    data: &[u8],
    password: Option<String>,
) -> PyResult<Vec<(String, Vec<u8>)>> {
    ::chithi_core::seven::decompress(data, password.as_deref())
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

/// Validate that the given bytes are a 7z archive.
#[pyfunction(name = "validate_7z")]
fn pi_validate_7z(data: &[u8]) -> PyResult<bool> {
    ::chithi_core::seven::validate(data).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
    Ok(true)
}

#[pymodule]
fn python_binding(py: Python<'_>, m: &Bound<'_, pyo3::types::PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(pi_compress_7z)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_decompress_7z)(py)?)?;
    m.add_function(wrap_pyfunction!(pi_validate_7z)(py)?)?;
    Ok(())
}
