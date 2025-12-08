use crate::model::{Bin, BinType, BinValue, Field};
use byteorder::{ReadBytesExt, LE};
use std::convert::TryFrom;
use std::io::{Cursor, Read, Seek, SeekFrom, Write};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum BinError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid magic bytes")]
    InvalidMagic,
    #[error("Unknown type: {0}")]
    UnknownType(u8),
    #[error("Unexpected end of file")]
    UnexpectedEof,
    #[error("Invalid value for type {0:?}")]
    InvalidValue(BinType),
}

struct BinaryReader<'a> {
    cursor: Cursor<&'a [u8]>,
}

impl<'a> BinaryReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self {
            cursor: Cursor::new(data),
        }
    }

    fn position(&self) -> u64 {
        self.cursor.position()
    }

    fn read_u8(&mut self) -> Result<u8, BinError> {
        Ok(self.cursor.read_u8()?)
    }

    fn read_u16(&mut self) -> Result<u16, BinError> {
        Ok(self.cursor.read_u16::<LE>()?)
    }

    fn read_u32(&mut self) -> Result<u32, BinError> {
        Ok(self.cursor.read_u32::<LE>()?)
    }

    fn read_u64(&mut self) -> Result<u64, BinError> {
        Ok(self.cursor.read_u64::<LE>()?)
    }

    fn read_i8(&mut self) -> Result<i8, BinError> {
        Ok(self.cursor.read_i8()?)
    }

    fn read_i16(&mut self) -> Result<i16, BinError> {
        Ok(self.cursor.read_i16::<LE>()?)
    }

    fn read_i32(&mut self) -> Result<i32, BinError> {
        Ok(self.cursor.read_i32::<LE>()?)
    }

    fn read_i64(&mut self) -> Result<i64, BinError> {
        Ok(self.cursor.read_i64::<LE>()?)
    }

    fn read_f32(&mut self) -> Result<f32, BinError> {
        Ok(self.cursor.read_f32::<LE>()?)
    }

    fn read_bool(&mut self) -> Result<bool, BinError> {
        Ok(self.read_u8()? != 0)
    }

    fn read_string(&mut self) -> Result<String, BinError> {
        let len = self.read_u16()? as usize;
        let mut buf = vec![0u8; len];
        self.cursor.read_exact(&mut buf)?;
        Ok(String::from_utf8_lossy(&buf).into_owned())
    }

    fn read_type(&mut self) -> Result<BinType, BinError> {
        let raw = self.read_u8()?;
        BinType::try_from(raw).map_err(|_| BinError::UnknownType(raw))
    }

    fn read_vec2(&mut self) -> Result<[f32; 2], BinError> {
        Ok([self.read_f32()?, self.read_f32()?])
    }

    fn read_vec3(&mut self) -> Result<[f32; 3], BinError> {
        Ok([self.read_f32()?, self.read_f32()?, self.read_f32()?])
    }

    fn read_vec4(&mut self) -> Result<[f32; 4], BinError> {
        Ok([
            self.read_f32()?,
            self.read_f32()?,
            self.read_f32()?,
            self.read_f32()?,
        ])
    }

    fn read_mtx44(&mut self) -> Result<[f32; 16], BinError> {
        let mut m = [0.0; 16];
        for i in 0..16 {
            m[i] = self.read_f32()?;
        }
        Ok(m)
    }

    fn read_rgba(&mut self) -> Result<[u8; 4], BinError> {
        let mut buf = [0u8; 4];
        self.cursor.read_exact(&mut buf)?;
        Ok(buf)
    }

    fn read_value(&mut self, type_: &BinType) -> Result<BinValue, BinError> {
        match type_ {
            BinType::None => Ok(BinValue::None),
            BinType::Bool => Ok(BinValue::Bool(self.read_bool()?)),
            BinType::I8 => Ok(BinValue::I8(self.read_i8()?)),
            BinType::U8 => Ok(BinValue::U8(self.read_u8()?)),
            BinType::I16 => Ok(BinValue::I16(self.read_i16()?)),
            BinType::U16 => Ok(BinValue::U16(self.read_u16()?)),
            BinType::I32 => Ok(BinValue::I32(self.read_i32()?)),
            BinType::U32 => Ok(BinValue::U32(self.read_u32()?)),
            BinType::I64 => Ok(BinValue::I64(self.read_i64()?)),
            BinType::U64 => Ok(BinValue::U64(self.read_u64()?)),
            BinType::F32 => Ok(BinValue::F32(self.read_f32()?)),
            BinType::Vec2 => Ok(BinValue::Vec2(self.read_vec2()?)),
            BinType::Vec3 => Ok(BinValue::Vec3(self.read_vec3()?)),
            BinType::Vec4 => Ok(BinValue::Vec4(self.read_vec4()?)),
            BinType::Mtx44 => Ok(BinValue::Mtx44(self.read_mtx44()?)),
            BinType::Rgba => Ok(BinValue::Rgba(self.read_rgba()?)),
            BinType::String => Ok(BinValue::String(self.read_string()?)),
            BinType::Hash => Ok(BinValue::Hash { value: self.read_u32()?, name: None }),
            BinType::File => Ok(BinValue::File { value: self.read_u64()?, name: None }),
            BinType::List => self.read_list(),
            BinType::List2 => self.read_list2(),
            BinType::Pointer => self.read_pointer(),
            BinType::Embed => self.read_embed(),
            BinType::Link => Ok(BinValue::Link { value: self.read_u32()?, name: None }),
            BinType::Option => self.read_option(),
            BinType::Map => self.read_map(),
            BinType::Flag => Ok(BinValue::Flag(self.read_bool()?)),
        }
    }

    fn read_list(&mut self) -> Result<BinValue, BinError> {
        let value_type = self.read_type()?;
        if value_type.is_container() {
             return Err(BinError::InvalidValue(value_type));
        }
        let size = self.read_u32()?;
        let start_pos = self.position();
        let count = self.read_u32()?;
        let mut items = Vec::with_capacity(count as usize);
        for _ in 0..count {
            items.push(self.read_value(&value_type)?);
        }
        if self.position() != start_pos + size as u64 {
             // In strict mode we might error, but ritobin just asserts.
             // We'll trust the size for skipping if needed, but here we read exactly count items.
             // If the size doesn't match, it might be an issue, but let's proceed.
             // Actually ritobin asserts: bin_assert(reader.position() == position + size);
             // We should probably seek to ensure we are at the right place if we want to be robust,
             // or error if mismatch.
             self.cursor.seek(SeekFrom::Start(start_pos + size as u64))?;
        }
        Ok(BinValue::List { value_type, items })
    }

    fn read_list2(&mut self) -> Result<BinValue, BinError> {
        // List2 is same structure as List
        let value_type = self.read_type()?;
        if value_type.is_container() {
             return Err(BinError::InvalidValue(value_type));
        }
        let size = self.read_u32()?;
        let start_pos = self.position();
        let count = self.read_u32()?;
        let mut items = Vec::with_capacity(count as usize);
        for _ in 0..count {
            items.push(self.read_value(&value_type)?);
        }
        self.cursor.seek(SeekFrom::Start(start_pos + size as u64))?;
        Ok(BinValue::List2 { value_type, items })
    }

    fn read_pointer(&mut self) -> Result<BinValue, BinError> {
        let name = self.read_u32()?;
        if name == 0 {
            return Ok(BinValue::Pointer { name, name_str: None, items: vec![] });
        }
        let size = self.read_u32()?;
        let start_pos = self.position();
        let count = self.read_u16()?;
        let mut items = Vec::with_capacity(count as usize);
        for _ in 0..count {
            let key = self.read_u32()?;
            let type_ = self.read_type()?;
            let value = self.read_value(&type_)?;
            items.push(Field { key, key_str: None, value });
        }
        self.cursor.seek(SeekFrom::Start(start_pos + size as u64))?;
        Ok(BinValue::Pointer { name, name_str: None, items })
    }

    fn read_embed(&mut self) -> Result<BinValue, BinError> {
        let name = self.read_u32()?;
        let size = self.read_u32()?;
        let start_pos = self.position();
        let count = self.read_u16()?;
        let mut items = Vec::with_capacity(count as usize);
        for _ in 0..count {
            let key = self.read_u32()?;
            let type_ = self.read_type()?;
            let value = self.read_value(&type_)?;
            items.push(Field { key, key_str: None, value });
        }
        self.cursor.seek(SeekFrom::Start(start_pos + size as u64))?;
        Ok(BinValue::Embed { name, name_str: None, items })
    }

    fn read_option(&mut self) -> Result<BinValue, BinError> {
        let value_type = self.read_type()?;
        if value_type.is_container() {
             return Err(BinError::InvalidValue(value_type));
        }
        let count = self.read_u8()?;
        let item = if count != 0 {
            Some(Box::new(self.read_value(&value_type)?))
        } else {
            None
        };
        Ok(BinValue::Option { value_type, item })
    }

    fn read_map(&mut self) -> Result<BinValue, BinError> {
        let key_type = self.read_type()?;
        if !key_type.is_primitive() {
             return Err(BinError::InvalidValue(key_type));
        }
        let value_type = self.read_type()?;
        if value_type.is_container() {
             return Err(BinError::InvalidValue(value_type));
        }
        let size = self.read_u32()?;
        let start_pos = self.position();
        let count = self.read_u32()?;
        let mut items = Vec::with_capacity(count as usize);
        for _ in 0..count {
            let key = self.read_value(&key_type)?;
            let value = self.read_value(&value_type)?;
            items.push((key, value));
        }
        self.cursor.seek(SeekFrom::Start(start_pos + size as u64))?;
        Ok(BinValue::Map { key_type, value_type, items })
    }
}

pub fn read_bin(data: &[u8]) -> Result<Bin, BinError> {
    let mut reader = BinaryReader::new(data);
    let mut bin = Bin::new();

    let mut magic = [0u8; 4];
    reader.cursor.read_exact(&mut magic)?;
    
    let is_patch = if magic == *b"PTCH" {
        let _unk = reader.read_u64()?; // skip unk
        reader.cursor.read_exact(&mut magic)?; // read next magic
        bin.sections.insert("type".to_string(), BinValue::String("PTCH".to_string()));
        true
    } else {
        bin.sections.insert("type".to_string(), BinValue::String("PROP".to_string()));
        false
    };

    if magic != *b"PROP" {
        return Err(BinError::InvalidMagic);
    }

    let version = reader.read_u32()?;
    bin.sections.insert("version".to_string(), BinValue::U32(version));

    if version >= 2 {
        let linked_files_count = reader.read_u32()?;
        let mut linked_items = Vec::with_capacity(linked_files_count as usize);
        for _ in 0..linked_files_count {
            linked_items.push(BinValue::String(reader.read_string()?));
        }
        bin.sections.insert("linked".to_string(), BinValue::List { 
            value_type: BinType::String, 
            items: linked_items 
        });
    }

    let entry_count = reader.read_u32()?;
    let mut entry_name_hashes = Vec::with_capacity(entry_count as usize);
    for _ in 0..entry_count {
        entry_name_hashes.push(reader.read_u32()?);
    }

    let mut entries_items = Vec::with_capacity(entry_count as usize);
    for entry_name_hash in entry_name_hashes {
        let entry_length = reader.read_u32()?;
        let start_pos = reader.position();
        let entry_key_hash = reader.read_u32()?;
        let field_count = reader.read_u16()?;
        
        let mut fields = Vec::with_capacity(field_count as usize);
        for _ in 0..field_count {
            let name = reader.read_u32()?;
            let type_ = reader.read_type()?;
            let value = reader.read_value(&type_)?;
            fields.push(Field { key: name, key_str: None, value });
        }
        
        reader.cursor.seek(SeekFrom::Start(start_pos + entry_length as u64))?;
        
        entries_items.push((
            BinValue::Hash { value: entry_key_hash, name: None },
            BinValue::Embed { name: entry_name_hash, name_str: None, items: fields }
        ));
    }
    
    bin.sections.insert("entries".to_string(), BinValue::Map { 
        key_type: BinType::Hash, 
        value_type: BinType::Embed, 
        items: entries_items 
    });

    if is_patch {
        let patch_count = reader.read_u32()?;
        let mut patch_items = Vec::with_capacity(patch_count as usize);
        for _ in 0..patch_count {
            let patch_key_hash = reader.read_u32()?;
            let patch_length = reader.read_u32()?;
            let start_pos = reader.position();
            
            let type_ = reader.read_type()?;
            let name = reader.read_string()?;
            let value = reader.read_value(&type_)?;
            
            reader.cursor.seek(SeekFrom::Start(start_pos + patch_length as u64))?;
            
            // Patch is stored as an Embed with "path" and "value" fields in ritobin
            let fields = vec![
                Field { key: crate::hash::Fnv1a::new("path").0, key_str: Some("path".to_string()), value: BinValue::String(name) },
                Field { key: crate::hash::Fnv1a::new("value").0, key_str: Some("value".to_string()), value },
            ];
            
            patch_items.push((
                BinValue::Hash { value: patch_key_hash, name: None },
                BinValue::Embed { name: crate::hash::Fnv1a::new("patch").0, name_str: None, items: fields }
            ));
        }
        bin.sections.insert("patches".to_string(), BinValue::Map {
            key_type: BinType::Hash,
            value_type: BinType::Embed,
            items: patch_items
        });
    }

    Ok(bin)
}

use byteorder::WriteBytesExt;

struct BinaryWriter {
    cursor: Cursor<Vec<u8>>,
}

impl BinaryWriter {
    fn new() -> Self {
        Self {
            cursor: Cursor::new(Vec::new()),
        }
    }

    fn position(&self) -> u64 {
        self.cursor.position()
    }

    fn into_inner(self) -> Vec<u8> {
        self.cursor.into_inner()
    }

    fn write_u8(&mut self, v: u8) -> Result<(), BinError> {
        self.cursor.write_u8(v)?;
        Ok(())
    }

    fn write_u16(&mut self, v: u16) -> Result<(), BinError> {
        self.cursor.write_u16::<LE>(v)?;
        Ok(())
    }

    fn write_u32(&mut self, v: u32) -> Result<(), BinError> {
        self.cursor.write_u32::<LE>(v)?;
        Ok(())
    }

    fn write_u64(&mut self, v: u64) -> Result<(), BinError> {
        self.cursor.write_u64::<LE>(v)?;
        Ok(())
    }

    fn write_i8(&mut self, v: i8) -> Result<(), BinError> {
        self.cursor.write_i8(v)?;
        Ok(())
    }

    fn write_i16(&mut self, v: i16) -> Result<(), BinError> {
        self.cursor.write_i16::<LE>(v)?;
        Ok(())
    }

    fn write_i32(&mut self, v: i32) -> Result<(), BinError> {
        self.cursor.write_i32::<LE>(v)?;
        Ok(())
    }

    fn write_i64(&mut self, v: i64) -> Result<(), BinError> {
        self.cursor.write_i64::<LE>(v)?;
        Ok(())
    }

    fn write_f32(&mut self, v: f32) -> Result<(), BinError> {
        self.cursor.write_f32::<LE>(v)?;
        Ok(())
    }

    fn write_bool(&mut self, v: bool) -> Result<(), BinError> {
        self.write_u8(if v { 1 } else { 0 })
    }

    fn write_string(&mut self, v: &str) -> Result<(), BinError> {
        self.write_u16(v.len() as u16)?;
        self.cursor.write_all(v.as_bytes())?;
        Ok(())
    }

    fn write_type(&mut self, v: BinType) -> Result<(), BinError> {
        self.write_u8(v as u8)
    }

    fn write_vec2(&mut self, v: [f32; 2]) -> Result<(), BinError> {
        for x in v { self.write_f32(x)?; }
        Ok(())
    }

    fn write_vec3(&mut self, v: [f32; 3]) -> Result<(), BinError> {
        for x in v { self.write_f32(x)?; }
        Ok(())
    }

    fn write_vec4(&mut self, v: [f32; 4]) -> Result<(), BinError> {
        for x in v { self.write_f32(x)?; }
        Ok(())
    }

    fn write_mtx44(&mut self, v: [f32; 16]) -> Result<(), BinError> {
        for x in v { self.write_f32(x)?; }
        Ok(())
    }

    fn write_rgba(&mut self, v: [u8; 4]) -> Result<(), BinError> {
        self.cursor.write_all(&v)?;
        Ok(())
    }

    fn write_at(&mut self, pos: u64, v: u32) -> Result<(), BinError> {
        let current = self.position();
        self.cursor.seek(SeekFrom::Start(pos))?;
        self.write_u32(v)?;
        self.cursor.seek(SeekFrom::Start(current))?;
        Ok(())
    }
    
    fn write_u32_slice_at(&mut self, pos: u64, v: &[u32]) -> Result<(), BinError> {
        let current = self.position();
        self.cursor.seek(SeekFrom::Start(pos))?;
        for &x in v {
            self.write_u32(x)?;
        }
        self.cursor.seek(SeekFrom::Start(current))?;
        Ok(())
    }

    fn skip(&mut self, amount: u64) -> Result<(), BinError> {
        let current = self.position();
        // Extend vector if needed
        let new_len = current + amount;
        if new_len > self.cursor.get_ref().len() as u64 {
            self.cursor.get_mut().resize(new_len as usize, 0);
        }
        self.cursor.seek(SeekFrom::Start(new_len))?;
        Ok(())
    }

    fn write_value(&mut self, v: &BinValue) -> Result<(), BinError> {
        match v {
            BinValue::None => {},
            BinValue::Bool(b) => self.write_bool(*b)?,
            BinValue::I8(i) => self.write_i8(*i)?,
            BinValue::U8(u) => self.write_u8(*u)?,
            BinValue::I16(i) => self.write_i16(*i)?,
            BinValue::U16(u) => self.write_u16(*u)?,
            BinValue::I32(i) => self.write_i32(*i)?,
            BinValue::U32(u) => self.write_u32(*u)?,
            BinValue::I64(i) => self.write_i64(*i)?,
            BinValue::U64(u) => self.write_u64(*u)?,
            BinValue::F32(f) => self.write_f32(*f)?,
            BinValue::Vec2(v) => self.write_vec2(*v)?,
            BinValue::Vec3(v) => self.write_vec3(*v)?,
            BinValue::Vec4(v) => self.write_vec4(*v)?,
            BinValue::Mtx44(v) => self.write_mtx44(*v)?,
            BinValue::Rgba(v) => self.write_rgba(*v)?,
            BinValue::String(s) => self.write_string(s)?,
            BinValue::Hash { value, .. } => self.write_u32(*value)?,
            BinValue::File { value, .. } => self.write_u64(*value)?,
            BinValue::List { value_type, items } => self.write_list(*value_type, items)?,
            BinValue::List2 { value_type, items } => self.write_list2(*value_type, items)?,
            BinValue::Pointer { name, items, .. } => self.write_pointer(*name, items)?,
            BinValue::Embed { name, items, .. } => self.write_embed(*name, items)?,
            BinValue::Link { value, .. } => self.write_u32(*value)?,
            BinValue::Option { value_type, item } => self.write_option(*value_type, item.as_ref().map(|b| b.as_ref()))?,
            BinValue::Map { key_type, value_type, items } => self.write_map(*key_type, *value_type, items)?,
            BinValue::Flag(b) => self.write_bool(*b)?,
        }
        Ok(())
    }

    fn write_list(&mut self, value_type: BinType, items: &[BinValue]) -> Result<(), BinError> {
        self.write_type(value_type)?;
        let size_pos = self.position();
        self.write_u32(0)?; // size placeholder
        let start_pos = self.position(); // start_pos is HERE, before count
        self.write_u32(items.len() as u32);
        for item in items {
            self.write_value(item)?;
        }
        let end_pos = self.position();
        self.write_at(size_pos, (end_pos - start_pos) as u32)?; // size includes count + items
        Ok(())
    }

    fn write_list2(&mut self, value_type: BinType, items: &[BinValue]) -> Result<(), BinError> {
        self.write_type(value_type)?;
        let size_pos = self.position();
        self.write_u32(0)?; // size placeholder
        let start_pos = self.position(); // start_pos is HERE, before count
        self.write_u32(items.len() as u32);
        for item in items {
            self.write_value(item)?;
        }
        let end_pos = self.position();
        self.write_at(size_pos, (end_pos - start_pos) as u32)?; // size includes count + items
        Ok(())
    }

    fn write_pointer(&mut self, name: u32, items: &[Field]) -> Result<(), BinError> {
        self.write_u32(name)?;
        if name == 0 {
            return Ok(());
        }
        let size_pos = self.position();
        self.write_u32(0)?; // size placeholder
        self.write_u16(items.len() as u16)?;
        let start_pos = self.position();
        for field in items {
            self.write_u32(field.key)?;
            let type_ = get_value_type(&field.value);
            self.write_type(type_)?;
            self.write_value(&field.value)?;
        }
        let end_pos = self.position();
        self.write_at(size_pos, (end_pos - start_pos) as u32)?;
        Ok(())
    }

    fn write_embed(&mut self, name: u32, items: &[Field]) -> Result<(), BinError> {
        self.write_u32(name)?;
        let size_pos = self.position();
        self.write_u32(0)?; // size placeholder
        self.write_u16(items.len() as u16)?;
        let start_pos = self.position();
        for field in items {
            self.write_u32(field.key)?;
            let type_ = get_value_type(&field.value);
            self.write_type(type_)?;
            self.write_value(&field.value)?;
        }
        let end_pos = self.position();
        self.write_at(size_pos, (end_pos - start_pos) as u32)?;
        Ok(())
    }

    fn write_option(&mut self, value_type: BinType, item: Option<&BinValue>) -> Result<(), BinError> {
        self.write_type(value_type)?;
        match item {
            Some(v) => {
                self.write_u8(1)?;
                self.write_value(v)?;
            },
            None => {
                self.write_u8(0)?;
            }
        }
        Ok(())
    }

    fn write_map(&mut self, key_type: BinType, value_type: BinType, items: &[(BinValue, BinValue)]) -> Result<(), BinError> {
        self.write_type(key_type)?;
        self.write_type(value_type)?;
        let size_pos = self.position();
        self.write_u32(0)?; // size placeholder
        let start_pos = self.position(); // start_pos is HERE, before count
        self.write_u32(items.len() as u32);
        for (key, value) in items {
            self.write_value(key)?;
            self.write_value(value)?;
        }
        let end_pos = self.position();
        self.write_at(size_pos, (end_pos - start_pos) as u32)?; // size includes count + items
        Ok(())
    }
}

fn get_value_type(v: &BinValue) -> BinType {
    match v {
        BinValue::None => BinType::None,
        BinValue::Bool(_) => BinType::Bool,
        BinValue::I8(_) => BinType::I8,
        BinValue::U8(_) => BinType::U8,
        BinValue::I16(_) => BinType::I16,
        BinValue::U16(_) => BinType::U16,
        BinValue::I32(_) => BinType::I32,
        BinValue::U32(_) => BinType::U32,
        BinValue::I64(_) => BinType::I64,
        BinValue::U64(_) => BinType::U64,
        BinValue::F32(_) => BinType::F32,
        BinValue::Vec2(_) => BinType::Vec2,
        BinValue::Vec3(_) => BinType::Vec3,
        BinValue::Vec4(_) => BinType::Vec4,
        BinValue::Mtx44(_) => BinType::Mtx44,
        BinValue::Rgba(_) => BinType::Rgba,
        BinValue::String(_) => BinType::String,
        BinValue::Hash { .. } => BinType::Hash,
        BinValue::File { .. } => BinType::File,
        BinValue::List { .. } => BinType::List,
        BinValue::List2 { .. } => BinType::List2,
        BinValue::Pointer { .. } => BinType::Pointer,
        BinValue::Embed { .. } => BinType::Embed,
        BinValue::Link { .. } => BinType::Link,
        BinValue::Option { .. } => BinType::Option,
        BinValue::Map { .. } => BinType::Map,
        BinValue::Flag(_) => BinType::Flag,
    }
}

pub fn write_bin(bin: &Bin) -> Result<Vec<u8>, BinError> {
    let mut writer = BinaryWriter::new();

    let type_section = bin.sections.get("type").ok_or(BinError::InvalidValue(BinType::None))?;
    let type_str = match type_section {
        BinValue::String(s) => s,
        _ => return Err(BinError::InvalidValue(BinType::String)),
    };

    if type_str == "PTCH" {
        writer.cursor.write_all(b"PTCH")?;
        writer.write_u64(1)?; // ritobin writes u32(1) + u32(0) = u64(1) LE
    }

    writer.cursor.write_all(b"PROP")?;

    let version_section = bin.sections.get("version").ok_or(BinError::InvalidValue(BinType::None))?;
    let version = match version_section {
        BinValue::U32(v) => *v,
        _ => return Err(BinError::InvalidValue(BinType::U32)),
    };
    writer.write_u32(version)?;

    if version >= 2 {
        if let Some(linked_section) = bin.sections.get("linked") {
            if let BinValue::List { items, .. } = linked_section {
                writer.write_u32(items.len() as u32)?;
                for item in items {
                    if let BinValue::String(s) = item {
                        writer.write_string(s)?;
                    }
                }
            } else {
                writer.write_u32(0)?;
            }
        } else {
            writer.write_u32(0)?;
        }
    }

    if let Some(entries_section) = bin.sections.get("entries") {
        if let BinValue::Map { items, .. } = entries_section {
            writer.write_u32(items.len() as u32)?;
            let hashes_pos = writer.position();
            writer.skip((items.len() * 4) as u64)?;
            
            let mut hashes = Vec::with_capacity(items.len());
            for (key, value) in items {
                if let BinValue::Embed { name, items: fields, .. } = value {
                    hashes.push(*name);
                    if let BinValue::Hash { value: h, .. } = key {
                        let entry_pos = writer.position();
                        writer.write_u32(0)?; // size placeholder
                        writer.write_u32(*h)?;
                        writer.write_u16(fields.len() as u16)?;
                        let start_pos = writer.position();
                        for field in fields {
                            writer.write_u32(field.key)?;
                            let type_ = get_value_type(&field.value);
                            writer.write_type(type_)?;
                            writer.write_value(&field.value)?;
                        }
                        let end_pos = writer.position();
                        writer.write_at(entry_pos, (end_pos - start_pos) as u32)?;
                    }
                }
            }
            writer.write_u32_slice_at(hashes_pos, &hashes)?;
        } else {
            writer.write_u32(0)?;
        }
    } else {
        writer.write_u32(0)?;
    }

    if type_str == "PTCH" && version >= 3 {
         // Patches
         if let Some(patches_section) = bin.sections.get("patches") {
            if let BinValue::Map { items, .. } = patches_section {
                writer.write_u32(items.len() as u32)?;
                for (key, value) in items {
                    if let BinValue::Hash { value: h, .. } = key {
                        writer.write_u32(*h)?;
                        let entry_pos = writer.position();
                        writer.write_u32(0)?; // size placeholder
                        
                        if let BinValue::Embed { items: fields, .. } = value {
                            // Expect "path" and "value" fields
                            let path_field = fields.iter().find(|f| f.key == crate::hash::Fnv1a::new("path").0);
                            let value_field = fields.iter().find(|f| f.key == crate::hash::Fnv1a::new("value").0);
                            
                            if let (Some(path), Some(val)) = (path_field, value_field) {
                                let val_type = get_value_type(&val.value);
                                writer.write_type(val_type)?;
                                if let BinValue::String(s) = &path.value {
                                    writer.write_string(s)?;
                                }
                                writer.write_value(&val.value)?;
                            }
                        }
                        
                        let end_pos = writer.position();
                        writer.write_at(entry_pos, (end_pos - entry_pos - 4) as u32)?;
                    }
                }
            } else {
                writer.write_u32(0)?;
            }
         } else {
             writer.write_u32(0)?;
         }
    }

    Ok(writer.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_empty_bin() {
        let mut data = Vec::new();
        data.extend_from_slice(b"PROP");
        data.extend_from_slice(&1u32.to_le_bytes()); // Version
        data.extend_from_slice(&0u32.to_le_bytes()); // Entry count
        // No entry name hashes
        // No entries

        let bin = read_bin(&data).unwrap();
        assert_eq!(bin.sections.get("type").unwrap(), &BinValue::String("PROP".to_string()));
        assert_eq!(bin.sections.get("version").unwrap(), &BinValue::U32(1));
        
        if let BinValue::Map { items, .. } = bin.sections.get("entries").unwrap() {
            assert_eq!(items.len(), 0);
        } else {
            panic!("entries is not a map");
        }
    }

    #[test]
    fn test_round_trip() {
        let mut bin = Bin::new();
        bin.sections.insert("type".to_string(), BinValue::String("PROP".to_string()));
        bin.sections.insert("version".to_string(), BinValue::U32(1));
        bin.sections.insert("entries".to_string(), BinValue::Map { 
            key_type: BinType::Hash, 
            value_type: BinType::Embed, 
            items: vec![] 
        });

        let data = write_bin(&bin).unwrap();
        let bin2 = read_bin(&data).unwrap();

        assert_eq!(bin.sections.get("type"), bin2.sections.get("type"));
        assert_eq!(bin.sections.get("version"), bin2.sections.get("version"));
    }
}
