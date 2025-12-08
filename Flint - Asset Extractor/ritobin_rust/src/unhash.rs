use crate::model::{Bin, BinValue};
use crate::hash_binary::{BinaryHashReader, BinaryHashWriter};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;

pub struct BinUnhasher {
    fnv1a: HashMap<u32, String>,
    xxh64: HashMap<u64, String>,
}

impl BinUnhasher {
    pub fn new() -> Self {
        Self {
            fnv1a: HashMap::new(),
            xxh64: HashMap::new(),
        }
    }

    /// Load hashes automatically - tries binary format first, falls back to text
    /// 
    /// This is the recommended way to load hashes as it will use the fastest
    /// available format.
    pub fn load_auto(&mut self, path: &str) -> std::io::Result<()> {
        // Try binary first (much faster)
        let bin_path = if path.ends_with(".txt") {
            path.replace(".txt", ".bin")
        } else {
            format!("{}.bin", path)
        };

        if Path::new(&bin_path).exists() {
            eprintln!("Loading binary hash file: {}", bin_path);
            return self.load_binary_file(&bin_path);
        }

        // Fallback to text format
        eprintln!("Loading text hash file: {}", path);
        if path.contains("hashes.game.txt") || path.contains("fnv1a") {
            self.load_fnv1a_cdtb(path);
        } else if path.contains("xxh64") {
            self.load_xxh64_cdtb(path);
        } else {
            // Try to detect format
            self.load_fnv1a_cdtb(path);
        }
        
        Ok(())
    }

    /// Load from binary format file
    pub fn load_binary_file(&mut self, path: &str) -> std::io::Result<()> {
        let file = File::open(path)?;
        self.load_binary(file)
    }

    /// Load from binary format reader
    pub fn load_binary<R: Read>(&mut self, reader: R) -> std::io::Result<()> {
        let mut hash_reader = BinaryHashReader::new(reader);
        let (fnv1a, xxh64) = hash_reader.read_hashes()?;
        
        // Merge with existing hashes
        self.fnv1a.extend(fnv1a);
        self.xxh64.extend(xxh64);
        
        Ok(())
    }

    /// Save to binary format file
    pub fn save_binary_file(&self, path: &str) -> std::io::Result<()> {
        let file = File::create(path)?;
        self.save_binary(file)
    }

    /// Save to binary format writer
    pub fn save_binary<W: Write>(&self, writer: W) -> std::io::Result<()> {
        let mut hash_writer = BinaryHashWriter::new(writer);
        hash_writer.write_hashes(&self.fnv1a, &self.xxh64)
    }

    /// Convert text hash file to binary format
    /// 
    /// Returns the number of hashes converted
    pub fn convert_text_to_binary(input_path: &str, output_path: &str) -> std::io::Result<usize> {
        let mut unhasher = BinUnhasher::new();
        
        // Load from text
        if input_path.contains("fnv1a") || input_path.contains("hashes.game") {
            unhasher.load_fnv1a_cdtb(input_path);
        } else if input_path.contains("xxh64") {
            unhasher.load_xxh64_cdtb(input_path);
        } else {
            // Try both
            unhasher.load_fnv1a_cdtb(input_path);
            unhasher.load_xxh64_cdtb(input_path);
        }
        
        let total = unhasher.fnv1a.len() + unhasher.xxh64.len();
        
        // Save to binary
        unhasher.save_binary_file(output_path)?;
        
        Ok(total)
    }

    pub fn load_fnv1a_cdtb(&mut self, path: &str) -> bool {
        if let Ok(file) = File::open(path) {
            self.load_fnv1a_from_reader(BufReader::new(file))
        } else {
            // Try with suffix .0, .1, etc.
            let mut i = 0;
            let mut loaded_any = false;
            loop {
                let p = format!("{}.{}", path, i);
                if let Ok(file) = File::open(&p) {
                    if self.load_fnv1a_from_reader(BufReader::new(file)) {
                        loaded_any = true;
                    }
                } else {
                    break;
                }
                i += 1;
            }
            loaded_any
        }
    }

    fn load_fnv1a_from_reader<R: BufRead>(&mut self, reader: R) -> bool {
        for line in reader.lines() {
            if let Ok(line) = line {
                if line.is_empty() { continue; }
                if let Some(idx) = line.find(' ') {
                    if let Ok(hash) = u32::from_str_radix(&line[..idx], 16) {
                        let name = line[idx+1..].to_string();
                        self.fnv1a.insert(hash, name);
                    }
                }
            }
        }
        true
    }

    pub fn load_xxh64_cdtb(&mut self, path: &str) -> bool {
        if let Ok(file) = File::open(path) {
            self.load_xxh64_from_reader(BufReader::new(file))
        } else {
            let mut i = 0;
            let mut loaded_any = false;
            loop {
                let p = format!("{}.{}", path, i);
                if let Ok(file) = File::open(&p) {
                    if self.load_xxh64_from_reader(BufReader::new(file)) {
                        loaded_any = true;
                    }
                } else {
                    break;
                }
                i += 1;
            }
            loaded_any
        }
    }

    fn load_xxh64_from_reader<R: BufRead>(&mut self, reader: R) -> bool {
        for line in reader.lines() {
            if let Ok(line) = line {
                if line.is_empty() { continue; }
                if let Some(idx) = line.find(' ') {
                    if let Ok(hash) = u64::from_str_radix(&line[..idx], 16) {
                        let name = line[idx+1..].to_string();
                        self.xxh64.insert(hash, name);
                    }
                }
            }
        }
        true
    }

    pub fn unhash_bin(&self, bin: &mut Bin) {
        for value in bin.sections.values_mut() {
            self.unhash_value(value);
        }
    }

    fn unhash_value(&self, value: &mut BinValue) {
        match value {
            BinValue::Hash { value: h, name } => {
                if name.is_none() {
                    if let Some(s) = self.fnv1a.get(h) {
                        *name = Some(s.clone());
                    }
                }
            },
            BinValue::File { value: h, name } => {
                if name.is_none() {
                    if let Some(s) = self.xxh64.get(h) {
                        *name = Some(s.clone());
                    }
                }
            },
            BinValue::Link { value: h, name } => {
                if name.is_none() {
                    if let Some(s) = self.fnv1a.get(h) {
                        *name = Some(s.clone());
                    }
                }
            },
            BinValue::List { items, .. } | BinValue::List2 { items, .. } => {
                for item in items {
                    self.unhash_value(item);
                }
            },
            BinValue::Option { item, .. } => {
                if let Some(inner) = item {
                    self.unhash_value(inner);
                }
            },
            BinValue::Map { items, .. } => {
                for (k, v) in items {
                    self.unhash_value(k);
                    self.unhash_value(v);
                }
            },
            BinValue::Pointer { name, name_str, items } => {
                if name_str.is_none() {
                    if let Some(s) = self.fnv1a.get(name) {
                        *name_str = Some(s.clone());
                    }
                }
                for field in items {
                    if field.key_str.is_none() {
                        if let Some(s) = self.fnv1a.get(&field.key) {
                            field.key_str = Some(s.clone());
                        }
                    }
                    self.unhash_value(&mut field.value);
                }
            },
            BinValue::Embed { name, name_str, items } => {
                if name_str.is_none() {
                    if let Some(s) = self.fnv1a.get(name) {
                        *name_str = Some(s.clone());
                    }
                }
                for field in items {
                    if field.key_str.is_none() {
                        if let Some(s) = self.fnv1a.get(&field.key) {
                            field.key_str = Some(s.clone());
                        }
                    }
                    self.unhash_value(&mut field.value);
                }
            },
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Bin, BinValue};
    use std::io::Write;

    #[test]
    fn test_unhash_basic() {
        // Create dummy hash file
        let mut file = std::fs::File::create("test_hashes.txt").unwrap();
        writeln!(file, "12345678 test_hash").unwrap();
        
        let mut unhasher = BinUnhasher::new();
        unhasher.load_fnv1a_cdtb("test_hashes.txt");
        
        let mut bin = Bin::new();
        bin.sections.insert("test".to_string(), BinValue::Hash { value: 0x12345678, name: None });
        
        unhasher.unhash_bin(&mut bin);
        
        if let Some(BinValue::Hash { name, .. }) = bin.sections.get("test") {
            assert_eq!(name.as_deref(), Some("test_hash"));
        } else {
            panic!("Expected Hash");
        }
        
        std::fs::remove_file("test_hashes.txt").unwrap();
    }
}
