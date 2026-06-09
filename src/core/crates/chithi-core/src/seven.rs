use std::io::Cursor;

use sevenz_rust2::{ArchiveEntry, ArchiveReader, ArchiveWriter, Password};

/// 7z magic bytes: 0x37 0x7A 0xBC 0xAF 0x27 0x1C
pub const SEVENZ_MAGIC: [u8; 6] = [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C];

/// Compress files into a 7z archive with optional AES-256 encryption.
/// If password is Some, all entries are encrypted with AES-256.
pub fn compress(
    files: &[(String, Vec<u8>)],
    password: Option<&str>,
) -> Result<Vec<u8>, String> {
    let buffer = vec![0u8; 32];
    let cursor = Cursor::new(buffer);
    let mut writer = ArchiveWriter::new(cursor)
        .map_err(|e| format!("Failed to create 7z writer: {e}"))?;

    for (name, data) in files {
        let mut entry = ArchiveEntry::new_file(name);
        if let Some(pwd) = password {
            entry.encrypt(Password::new(pwd));
        }
        writer
            .push_archive_entry(entry, Some(Cursor::new(data)))
            .map_err(|e| format!("Failed to add file {name}: {e}"))?;
    }

    let cursor = writer.finish().map_err(|e| format!("Failed to finish archive: {e}"))?;
    Ok(cursor.into_inner())
}

/// Decompress a 7z archive with optional password for encrypted archives.
pub fn decompress(
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

/// Validate that the given bytes are a 7z archive by checking magic bytes.
pub fn validate(data: &[u8]) -> Result<(), String> {
    if data.len() < SEVENZ_MAGIC.len() {
        return Err("Data is too small to be a valid 7z archive".into());
    }
    if data[..SEVENZ_MAGIC.len()] != SEVENZ_MAGIC {
        return Err("Data does not start with 7z magic bytes".into());
    }
    Ok(())
}
