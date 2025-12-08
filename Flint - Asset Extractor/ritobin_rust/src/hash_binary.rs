use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use std::collections::HashMap;
use std::io::{Read, Result, Write};

const MAGIC: &[u8; 4] = b"HHSH";
const VERSION: i32 = 1;

/// Writer for binary hash files compatible with C# implementation
/// 
/// Binary format is much faster to load than text format (10-50x speedup)
/// and produces smaller files.
pub struct BinaryHashWriter<W: Write> {
    writer: W,
}

impl<W: Write> BinaryHashWriter<W> {
    pub fn new(writer: W) -> Self {
        Self { writer }
    }

    /// Write hash maps to binary format
    /// 
    /// Format:
    /// - Magic: "HHSH" (4 bytes)
    /// - Version: i32 (4 bytes)
    /// - FNV1a Count: i32 (4 bytes)
    /// - XXH64 Count: i32 (4 bytes)
    /// - FNV1a entries: [u32 hash, string]...
    /// - XXH64 entries: [u64 hash, string]...
    pub fn write_hashes(
        &mut self,
        fnv1a: &HashMap<u32, String>,
        xxh64: &HashMap<u64, String>,
    ) -> Result<()> {
        // Write header
        self.writer.write_all(MAGIC)?;
        self.writer.write_i32::<LittleEndian>(VERSION)?;
        self.writer.write_i32::<LittleEndian>(fnv1a.len() as i32)?;
        self.writer.write_i32::<LittleEndian>(xxh64.len() as i32)?;

        // Write FNV1a entries
        for (&hash, string) in fnv1a {
            self.writer.write_u32::<LittleEndian>(hash)?;
            self.write_string(string)?;
        }

        // Write XXH64 entries
        for (&hash, string) in xxh64 {
            self.writer.write_u64::<LittleEndian>(hash)?;
            self.write_string(string)?;
        }

        Ok(())
    }

    /// Write string with .NET BinaryWriter compatible length prefix
    fn write_string(&mut self, s: &str) -> Result<()> {
        let bytes = s.as_bytes();
        self.write_7bit_encoded_int(bytes.len())?;
        self.writer.write_all(bytes)?;
        Ok(())
    }

    /// Write 7-bit encoded integer (.NET BinaryWriter format)
    /// 
    /// This encoding uses the high bit of each byte as a continuation flag.
    /// Values 0-127 use 1 byte, 128-16383 use 2 bytes, etc.
    fn write_7bit_encoded_int(&mut self, mut value: usize) -> Result<()> {
        while value >= 0x80 {
            self.writer.write_u8((value | 0x80) as u8)?;
            value >>= 7;
        }
        self.writer.write_u8(value as u8)?;
        Ok(())
    }
}

/// Reader for binary hash files compatible with C# implementation
pub struct BinaryHashReader<R: Read> {
    reader: R,
}

impl<R: Read> BinaryHashReader<R> {
    pub fn new(reader: R) -> Self {
        Self { reader }
    }

    /// Read hash maps from binary format
    /// 
    /// Returns (fnv1a_map, xxh64_map)
    pub fn read_hashes(&mut self) -> Result<(HashMap<u32, String>, HashMap<u64, String>)> {
        // Read and verify header
        let mut magic = [0u8; 4];
        self.reader.read_exact(&mut magic)?;
        if &magic != MAGIC {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Invalid magic bytes: expected HHSH, got {:?}", 
                    String::from_utf8_lossy(&magic)),
            ));
        }

        let version = self.reader.read_i32::<LittleEndian>()?;
        if version != VERSION {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Unsupported version: {}, expected {}", version, VERSION),
            ));
        }

        let fnv1a_count = self.reader.read_i32::<LittleEndian>()? as usize;
        let xxh64_count = self.reader.read_i32::<LittleEndian>()? as usize;

        // Pre-allocate with capacity for better performance
        let mut fnv1a = HashMap::with_capacity(fnv1a_count);
        let mut xxh64 = HashMap::with_capacity(xxh64_count);

        // Read FNV1a entries
        for _ in 0..fnv1a_count {
            let hash = self.reader.read_u32::<LittleEndian>()?;
            let string = self.read_string()?;
            fnv1a.insert(hash, string);
        }

        // Read XXH64 entries
        for _ in 0..xxh64_count {
            let hash = self.reader.read_u64::<LittleEndian>()?;
            let string = self.read_string()?;
            xxh64.insert(hash, string);
        }

        Ok((fnv1a, xxh64))
    }

    /// Read string with .NET BinaryReader compatible length prefix
    fn read_string(&mut self) -> Result<String> {
        let len = self.read_7bit_encoded_int()?;
        let mut buf = vec![0u8; len];
        self.reader.read_exact(&mut buf)?;
        String::from_utf8(buf).map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::InvalidData, e)
        })
    }

    /// Read 7-bit encoded integer (.NET BinaryReader format)
    fn read_7bit_encoded_int(&mut self) -> Result<usize> {
        let mut result = 0usize;
        let mut shift = 0;

        loop {
            let byte = self.reader.read_u8()?;
            result |= ((byte & 0x7F) as usize) << shift;

            if byte & 0x80 == 0 {
                break;
            }

            shift += 7;
            if shift >= 35 {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "Invalid 7-bit encoded int: too many bytes",
                ));
            }
        }

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_7bit_encoding_roundtrip() {
        let test_values = vec![0, 1, 127, 128, 255, 256, 16383, 16384, 2097151];

        for value in test_values {
            let mut buf = Vec::new();
            let mut writer = BinaryHashWriter::new(&mut buf);
            writer.write_7bit_encoded_int(value).unwrap();

            let mut reader = BinaryHashReader::new(&buf[..]);
            let decoded = reader.read_7bit_encoded_int().unwrap();

            assert_eq!(value, decoded, "Failed for value {}", value);
        }
    }

    #[test]
    fn test_string_roundtrip() {
        let long_string = "a".repeat(1000);
        let test_strings = vec![
            "",
            "hello",
            "Hello, World!",
            "Unicode: 你好世界 🦀",
            &long_string,
        ];

        for s in test_strings {
            let mut buf = Vec::new();
            let mut writer = BinaryHashWriter::new(&mut buf);
            writer.write_string(s).unwrap();

            let mut reader = BinaryHashReader::new(&buf[..]);
            let decoded = reader.read_string().unwrap();

            assert_eq!(s, decoded);
        }
    }

    #[test]
    fn test_hash_file_roundtrip() {
        let mut fnv1a = HashMap::new();
        fnv1a.insert(0x12345678, "test_hash_1".to_string());
        fnv1a.insert(0xabcdef00, "test_hash_2".to_string());

        let mut xxh64 = HashMap::new();
        xxh64.insert(0x123456789abcdef0, "test_file_1".to_string());
        xxh64.insert(0xfedcba9876543210, "test_file_2".to_string());

        // Write
        let mut buf = Vec::new();
        let mut writer = BinaryHashWriter::new(&mut buf);
        writer.write_hashes(&fnv1a, &xxh64).unwrap();

        // Read
        let mut reader = BinaryHashReader::new(&buf[..]);
        let (decoded_fnv1a, decoded_xxh64) = reader.read_hashes().unwrap();

        assert_eq!(fnv1a, decoded_fnv1a);
        assert_eq!(xxh64, decoded_xxh64);
    }

    #[test]
    fn test_empty_hashes() {
        let fnv1a = HashMap::new();
        let xxh64 = HashMap::new();

        let mut buf = Vec::new();
        let mut writer = BinaryHashWriter::new(&mut buf);
        writer.write_hashes(&fnv1a, &xxh64).unwrap();

        let mut reader = BinaryHashReader::new(&buf[..]);
        let (decoded_fnv1a, decoded_xxh64) = reader.read_hashes().unwrap();

        assert_eq!(fnv1a, decoded_fnv1a);
        assert_eq!(xxh64, decoded_xxh64);
    }

    #[test]
    fn test_invalid_magic() {
        let buf = b"XXXX\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        let mut reader = BinaryHashReader::new(&buf[..]);
        assert!(reader.read_hashes().is_err());
    }

    #[test]
    fn test_invalid_version() {
        let buf = b"HHSH\x02\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        let mut reader = BinaryHashReader::new(&buf[..]);
        assert!(reader.read_hashes().is_err());
    }
}
