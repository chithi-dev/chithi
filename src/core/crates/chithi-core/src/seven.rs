use std::io::Cursor;

use sevenz_rust2::encoder_options::{AesEncoderOptions, Lzma2Options};
use sevenz_rust2::{ArchiveEntry, ArchiveReader, ArchiveWriter, EncoderMethod, Password};

/// 7z magic bytes: 0x37 0x7A 0xBC 0xAF 0x27 0x1C
pub const SEVENZ_MAGIC: [u8; 6] = [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C];

/// Trait for 7z archive operations.
/// Default impl uses in-memory buffers. WASM/Python bindings can override for platform-specific I/O.
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

/// Default in-memory implementation of SevenZBackend.
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
