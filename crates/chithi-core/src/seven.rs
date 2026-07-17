use std::io::Cursor;

use ed25519_dalek::{SigningKey, Verifier};
use rand::rngs::OsRng;
use rand::RngCore;
use sevenz_rust2::encoder_options::{AesEncoderOptions, Lzma2Options};
use sevenz_rust2::{ArchiveEntry, ArchiveReader, ArchiveWriter, EncoderMethod, Password};

use crate::chithi_cryto::Progress;

pub const SEVENZ_MAGIC: [u8; 6] = [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C];

pub trait SevenZBackend {
    fn compress(
        files: &[(String, Vec<u8>)],
        password: Option<&str>,
    ) -> Result<Vec<u8>, String>;

    fn decompress(
        data: &[u8],
        password: Option<&str>,
    ) -> Result<Vec<(String, Vec<u8>)>, String>;

    fn validate(data: &[u8]) -> bool;
}

pub struct SevenZDefault;

impl SevenZBackend for SevenZDefault {
    fn compress(
        files: &[(String, Vec<u8>)],
        password: Option<&str>,
    ) -> Result<Vec<u8>, String> {
        let buffer = vec![0u8; 32];
        let cursor = Cursor::new(buffer);
        let mut writer = ArchiveWriter::new(cursor)
            .map_err(|e| format!("Failed to create 7z writer: {e}"))?;

        if let Some(pwd) = password {
            writer.set_content_methods(vec![
                AesEncoderOptions::new(Password::new(pwd)).into(),
                EncoderMethod::LZMA2.into(),
            ]);
        } else {
            writer.set_content_methods(vec![Lzma2Options::from_level(9).into()]);
        }

        for (name, data) in files {
            let entry = ArchiveEntry::new_file(name);
            writer
                .push_archive_entry(entry, Some(Cursor::new(data)))
                .map_err(|e| format!("Failed to add file {name}: {e}"))?;
        }

        let cursor = writer.finish().map_err(|e| format!("Failed to finish archive: {e}"))?;
        Ok(cursor.into_inner())
    }

    fn decompress(
        data: &[u8],
        password: Option<&str>,
    ) -> Result<Vec<(String, Vec<u8>)>, String> {
        let pwd = match password {
            Some(p) => Password::new(p),
            None => Password::empty(),
        };

        let source = Cursor::new(data);
        let mut reader = ArchiveReader::new(source, pwd)
            .map_err(|e| format!("Failed to open 7z archive: {e}"))?;

        let mut entries = Vec::new();

        reader
            .for_each_entries(|entry, entry_reader| {
                if !entry.is_directory() {
                    let name = entry.name().to_string();
                    let mut buf = Vec::new();
                    entry_reader
                        .read_to_end(&mut buf)
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to read entry {}: {e}", name)))?;
                    entries.push((name, buf));
                }
                Ok(true)
            })
            .map_err(|e| format!("Iteration error: {e}"))?;

        Ok(entries)
    }

    fn validate(data: &[u8]) -> bool {
        data.len() >= SEVENZ_MAGIC.len() && data[..SEVENZ_MAGIC.len()] == SEVENZ_MAGIC
    }
}

/// Build a SigningKey from raw 32-byte seed material.
fn signing_key_from_bytes(seed: &[u8; 32]) -> SigningKey {
    let sk: ed25519_dalek::SecretKey = unsafe { core::mem::transmute_copy(seed) };
    SigningKey::from_bytes(&sk)
}

/// SDK-level upload: compress files → encrypt in parallel.
pub fn sdk_compress_and_encrypt(
    files: &[(String, Vec<u8>)],
    password: Option<&str>,
    progress: Progress,
) -> Result<Vec<u8>, String> {
    use crate::chithi_cryto::{Keychain, parallel_encrypt_data};

    // Step 1: compress
    let compressed = SevenZDefault::compress(files, password)?;

    // Step 2: encrypt in parallel
    let keychain = match password {
        Some(p) => Keychain::from_password(p)?,
        None => Keychain::new(),
    };
    let key = keychain.export_auth_key();
    let salt = keychain.salt();

    let mut base_iv = [0u8; 12];
    OsRng.fill_bytes(&mut base_iv);

    let encrypted = parallel_encrypt_data(&compressed, &key, &base_iv, progress)?;
    let signature = keychain.sign(&encrypted);

    // Step 3: serialize: [salt(32)][base_iv(12)][signature_len(4)][signature][encrypted_data]
    let sig_len = signature.len() as u32;
    let total = 32 + 12 + 4 + sig_len as usize + encrypted.len();
    let mut bundle = Vec::with_capacity(total);
    bundle.extend_from_slice(&salt);
    bundle.extend_from_slice(&base_iv);
    bundle.extend_from_slice(&sig_len.to_be_bytes());
    bundle.extend_from_slice(&signature);
    bundle.extend_from_slice(&encrypted);

    Ok(bundle)
}

/// SDK-level download: decrypt in parallel → decompress.
pub fn sdk_decrypt_and_decompress(
    bundle: &[u8],
    password: Option<&str>,
    progress: Progress,
) -> Result<Vec<(String, Vec<u8>)>, String> {
    use crate::chithi_cryto::{derive_key, parallel_decrypt_data};

    if bundle.len() < 32 + 12 + 4 {
        return Err("Bundle too small".to_string());
    }

    let salt: [u8; 32] = bundle[..32].try_into().unwrap();
    let base_iv: [u8; 12] = bundle[32..44].try_into().unwrap();
    let sig_len = u32::from_be_bytes([
        bundle[44], bundle[45], bundle[46], bundle[47],
    ]) as usize;
    let signature = &bundle[48..48 + sig_len];
    let encrypted = &bundle[48 + sig_len..];

    // Derive key from password + salt
    let key = derive_key(
        password.unwrap_or("").as_bytes(),
        &salt,
    )?;

    // Verify signature
    let signing_key = signing_key_from_bytes(&key);
    let vk = signing_key.verifying_key();
    let sig = ed25519_dalek::Signature::from_slice(signature)
        .map_err(|_| "Invalid signature format".to_string())?;
    vk.verify(encrypted, &sig)
        .map_err(|_| "Signature verification failed".to_string())?;

    // Decrypt in parallel
    let decrypted = parallel_decrypt_data(encrypted, &key, &base_iv, progress)?;

    // Decompress
    SevenZDefault::decompress(&decrypted, password)
}
