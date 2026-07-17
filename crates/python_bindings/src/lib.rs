//! Native helper library for chithi-core.
//!
//! The Python bindings are provided by `bindings/python/` which loads
//! the WASM module via the wasmtime Python package. This crate exists
//! for native testing and integration helpers.

pub use chithi_core;

/// Verify the chithi-core crypto roundtrip works.
pub fn test_crypto_roundtrip() -> Result<(), String> {
    use chithi_core::chithi_cryto::{sdk_upload, sdk_download};
    let data = b"Hello, encrypted world!";
    let bundle = sdk_upload(data, "password", None)?;
    let decrypted = sdk_download(&bundle, "password", None)?;
    if decrypted != data {
        return Err("Roundtrip failed".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crypto_roundtrip_works() {
        assert!(test_crypto_roundtrip().is_ok());
    }
}
