use serde::{Deserialize, Serialize};

/// Type descriptor for binary values in League of Legends property files.
///
/// The binary format uses single-byte type identifiers. Primitive types use values 0-18,
/// while container types have bit 0x80 set (values 0x80-0x87).
///
/// # Examples
///
/// ```
/// use ritobin_rust::model::BinType;
///
/// // Check if a type is primitive
/// assert!(BinType::U32.is_primitive());
/// assert!(!BinType::List.is_primitive());
///
/// // Check if a type is a container
/// assert!(BinType::Map.is_container());
/// assert!(!BinType::String.is_container());
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BinType {
    None = 0,
    Bool = 1,
    I8 = 2,
    U8 = 3,
    I16 = 4,
    U16 = 5,
    I32 = 6,
    U32 = 7,
    I64 = 8,
    U64 = 9,
    F32 = 10,
    Vec2 = 11,
    Vec3 = 12,
    Vec4 = 13,
    Mtx44 = 14,
    Rgba = 15,
    String = 16,
    Hash = 17,
    File = 18,
    List = 0x80 | 0,
    List2 = 0x80 | 1,
    Pointer = 0x80 | 2,
    Embed = 0x80 | 3,
    Link = 0x80 | 4,
    Option = 0x80 | 5,
    Map = 0x80 | 6,
    Flag = 0x80 | 7,
}

impl TryFrom<u8> for BinType {
    type Error = u8;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(BinType::None),
            1 => Ok(BinType::Bool),
            2 => Ok(BinType::I8),
            3 => Ok(BinType::U8),
            4 => Ok(BinType::I16),
            5 => Ok(BinType::U16),
            6 => Ok(BinType::I32),
            7 => Ok(BinType::U32),
            8 => Ok(BinType::I64),
            9 => Ok(BinType::U64),
            10 => Ok(BinType::F32),
            11 => Ok(BinType::Vec2),
            12 => Ok(BinType::Vec3),
            13 => Ok(BinType::Vec4),
            14 => Ok(BinType::Mtx44),
            15 => Ok(BinType::Rgba),
            16 => Ok(BinType::String),
            17 => Ok(BinType::Hash),
            18 => Ok(BinType::File),
            0x80 => Ok(BinType::List),
            0x81 => Ok(BinType::List2),
            0x82 => Ok(BinType::Pointer),
            0x83 => Ok(BinType::Embed),
            0x84 => Ok(BinType::Link),
            0x85 => Ok(BinType::Option),
            0x86 => Ok(BinType::Map),
            0x87 => Ok(BinType::Flag),
            _ => Err(value),
        }
    }
}

impl BinType {
    /// Returns true if this is a primitive (non-container) type.
    ///
    /// Primitive types are stored inline, while container types contain other values.
    pub fn is_primitive(&self) -> bool {
        (*self as u8 & 0x80) == 0
    }

    /// Returns true if this is a container type that holds other values.
    ///
    /// Container types include Option, List, List2, and Map.
    pub fn is_container(&self) -> bool {
        matches!(self, BinType::Option | BinType::List | BinType::List2 | BinType::Map)
    }
}


impl std::str::FromStr for BinType {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "none" => Ok(BinType::None),
            "bool" => Ok(BinType::Bool),
            "i8" => Ok(BinType::I8),
            "u8" => Ok(BinType::U8),
            "i16" => Ok(BinType::I16),
            "u16" => Ok(BinType::U16),
            "i32" => Ok(BinType::I32),
            "u32" => Ok(BinType::U32),
            "i64" => Ok(BinType::I64),
            "u64" => Ok(BinType::U64),
            "f32" => Ok(BinType::F32),
            "vec2" => Ok(BinType::Vec2),
            "vec3" => Ok(BinType::Vec3),
            "vec4" => Ok(BinType::Vec4),
            "mtx44" => Ok(BinType::Mtx44),
            "rgba" => Ok(BinType::Rgba),
            "string" => Ok(BinType::String),
            "hash" => Ok(BinType::Hash),
            "file" => Ok(BinType::File),
            "list" => Ok(BinType::List),
            "list2" => Ok(BinType::List2),
            "pointer" => Ok(BinType::Pointer),
            "embed" => Ok(BinType::Embed),
            "link" => Ok(BinType::Link),
            "option" => Ok(BinType::Option),
            "map" => Ok(BinType::Map),
            "flag" => Ok(BinType::Flag),
            _ => Err(()),
        }
    }
}

/// A value in a League of Legends binary property file.
///
/// BinValue is an enum that can hold any of the 27 supported value types.
/// Hash types (`Hash`, `File`, `Link`) can optionally store their unhashed string names.
///
/// # Examples
///
/// ```
/// use ritobin_rust::model::BinValue;
///
/// // Create primitive values
/// let num = BinValue::U32(42);
/// let text = BinValue::String("Hello".to_string());
///
/// // Create hash value (can be unhashed later)
/// let hash = BinValue::Hash {
///     value: 0x12345678,
///     name: Some("ItemName".to_string()),
/// };
/// ```
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BinValue {
    None,
    Bool(bool),
    I8(i8),
    U8(u8),
    I16(i16),
    U16(u16),
    I32(i32),
    U32(u32),
    I64(i64),
    U64(u64),
    F32(f32),
    /// 2D vector [x, y]
    Vec2([f32; 2]),
    /// 3D vector [x, y, z]
    Vec3([f32; 3]),
    /// 4D vector [x, y, z, w]
    Vec4([f32; 4]),
    /// 4x4 matrix (row-major order)
    Mtx44([f32; 16]),
    /// RGBA color [r, g, b, a]
    Rgba([u8; 4]),
    String(String),
    /// FNV1a hash with optional unhashed name
    Hash { value: u32, name: Option<String> },
    /// XXH64 hash (file path) with optional unhashed name
    File { value: u64, name: Option<String> },
    /// List of values of a single type
    List {
        value_type: BinType,
        items: Vec<BinValue>,
    },
    /// Alternative list encoding
    List2 {
        value_type: BinType,
        items: Vec<BinValue>,
    },
    /// Pointer to a structure with named fields
    Pointer {
        name: u32,
        name_str: Option<String>,
        items: Vec<Field>,
    },
    /// Embedded structure with named fields
    Embed {
        name: u32,
        name_str: Option<String>,
        items: Vec<Field>,
    },
    /// Link to another property by hash
    Link { value: u32, name: Option<String> },
    /// Optional value (Some or None)
    Option {
        value_type: BinType,
        item: Option<Box<BinValue>>,
    },
    /// Dictionary/map of key-value pairs
    Map {
        key_type: BinType,
        value_type: BinType,
        items: Vec<(BinValue, BinValue)>,
    },
    /// Boolean flag
    Flag(bool),
}

/// A field in a `Pointer` or `Embed` structure.
///
/// Fields have a hash-based key (FNV1a) with an optional unhashed name,
/// and a value of any `BinValue` type.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Field {
    /// FNV1a hash of the field name
    pub key: u32,
    /// Unhashed field name (populated when hash files are loaded)
    pub key_str: Option<String>,
    /// The field's value
    pub value: BinValue,
}

/// A League of Legends binary property file (`.bin`).
///
/// A bin file contains named sections, each holding a `BinValue`.
/// Common sections include:
/// - `"type"`: Usually a string like "PROP"
/// - `"version"`: File format version (u32)
/// - `"entries"`: A map of game data entries
///
/// # Examples
///
/// ```
/// use ritobin_rust::model::{Bin, BinValue};
///
/// let mut bin = Bin::new();
/// bin.sections.insert("version".to_string(), BinValue::U32(3));
/// bin.sections.insert("name".to_string(), BinValue::String("Champion".to_string()));
/// ```
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Bin {
    /// Named sections of the bin file
    pub sections: indexmap::IndexMap<String, BinValue>,
}

impl Bin {
    /// Create a new empty bin file.
    pub fn new() -> Self {
        Self {
            sections: indexmap::IndexMap::new(),
        }
    }
}

impl Default for Bin {
    fn default() -> Self {
        Self::new()
    }
}
