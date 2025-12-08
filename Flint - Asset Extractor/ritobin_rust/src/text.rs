use crate::model::{Bin, BinType, BinValue};
use std::fmt::Write;

pub fn write_text(bin: &Bin) -> Result<String, std::fmt::Error> {
    let mut writer = TextWriter::new();
    writer.write_raw("#PROP_text\n");
    for (key, value) in &bin.sections {
        writer.write_section(key, value)?;
    }
    Ok(writer.buffer)
}



struct TextWriter {
    buffer: String,
    indent_level: usize,
    indent_size: usize,
}

impl TextWriter {
    fn new() -> Self {
        Self {
            buffer: String::new(),
            indent_level: 0,
            indent_size: 2,
        }
    }

    fn indent(&mut self) {
        self.indent_level += self.indent_size;
    }

    fn dedent(&mut self) {
        self.indent_level -= self.indent_size;
    }

    fn pad(&mut self) {
        for _ in 0..self.indent_level {
            self.buffer.push(' ');
        }
    }

    fn write_raw(&mut self, s: &str) {
        self.buffer.push_str(s);
    }

    fn write_section(&mut self, key: &str, value: &BinValue) -> Result<(), std::fmt::Error> {
        self.write_raw(key);
        self.write_raw(": ");
        self.write_type(value);
        self.write_raw(" = ");
        self.write_value(value)?;
        self.write_raw("\n");
        Ok(())
    }

    fn write_type(&mut self, value: &BinValue) {
        let type_name = get_type_name(value);
        self.write_raw(&type_name);
        
        match value {
            BinValue::List { value_type, .. } => {
                self.write_raw("[");
                self.write_raw(get_bin_type_name(*value_type));
                self.write_raw("]");
            },
            BinValue::List2 { value_type, .. } => {
                self.write_raw("[");
                self.write_raw(get_bin_type_name(*value_type));
                self.write_raw("]");
            },
            BinValue::Option { value_type, .. } => {
                self.write_raw("[");
                self.write_raw(get_bin_type_name(*value_type));
                self.write_raw("]");
            },
            BinValue::Map { key_type, value_type, .. } => {
                self.write_raw("[");
                self.write_raw(get_bin_type_name(*key_type));
                self.write_raw(",");
                self.write_raw(get_bin_type_name(*value_type));
                self.write_raw("]");
            },
            _ => {}
        }
    }

    fn write_value(&mut self, value: &BinValue) -> Result<(), std::fmt::Error> {
        match value {
            BinValue::None => self.write_raw("null"),
            BinValue::Bool(v) => self.write_raw(if *v { "true" } else { "false" }),
            BinValue::I8(v) => write!(self.buffer, "{}", v)?,
            BinValue::U8(v) => write!(self.buffer, "{}", v)?,
            BinValue::I16(v) => write!(self.buffer, "{}", v)?,
            BinValue::U16(v) => write!(self.buffer, "{}", v)?,
            BinValue::I32(v) => write!(self.buffer, "{}", v)?,
            BinValue::U32(v) => write!(self.buffer, "{}", v)?,
            BinValue::I64(v) => write!(self.buffer, "{}", v)?,
            BinValue::U64(v) => write!(self.buffer, "{}", v)?,
            BinValue::F32(v) => write!(self.buffer, "{:?}", v)?,
            BinValue::Vec2(v) => {
                write!(self.buffer, "{{ {}, {} }}", v[0], v[1])?;
            },
            BinValue::Vec3(v) => {
                write!(self.buffer, "{{ {}, {}, {} }}", v[0], v[1], v[2])?;
            },
            BinValue::Vec4(v) => {
                write!(self.buffer, "{{ {}, {}, {}, {} }}", v[0], v[1], v[2], v[3])?;
            },
            BinValue::Mtx44(v) => {
                self.indent();
                self.write_raw("{\n");
                self.pad();
                for (i, val) in v.iter().enumerate() {
                    write!(self.buffer, "{}", val)?;
                    if i % 4 == 3 {
                        self.write_raw("\n");
                        if i == 15 {
                            self.dedent();
                        }
                        self.pad();
                    } else {
                        self.write_raw(", ");
                    }
                }
                self.write_raw("}");
            },
            BinValue::Rgba(v) => {
                write!(self.buffer, "{{ {}, {}, {}, {} }}", v[0], v[1], v[2], v[3])?;
            },
            BinValue::String(v) => {
                write!(self.buffer, "{:?}", v)?;
            },
            BinValue::Hash { value, name } => {
                if let Some(s) = name {
                    write!(self.buffer, "{:?}", s)?;
                } else {
                    write!(self.buffer, "{:#x}", value)?;
                }
            },
            BinValue::File { value, name } => {
                if let Some(s) = name {
                    write!(self.buffer, "{:?}", s)?;
                } else {
                    write!(self.buffer, "{:#x}", value)?;
                }
            },
            BinValue::Link { value, name } => {
                if let Some(s) = name {
                    write!(self.buffer, "{:?}", s)?;
                } else {
                    write!(self.buffer, "{:#x}", value)?;
                }
            },
            BinValue::Flag(v) => self.write_raw(if *v { "true" } else { "false" }),
            
            BinValue::List { items, .. } | BinValue::List2 { items, .. } => {
                if items.is_empty() {
                    self.write_raw("{}");
                } else {
                    self.write_raw("{\n");
                    self.indent();
                    for item in items {
                        self.pad();
                        self.write_value(item)?;
                        self.write_raw("\n");
                    }
                    self.dedent();
                    self.pad();
                    self.write_raw("}");
                }
            },
            BinValue::Option { item, .. } => {
                if let Some(inner) = item {
                    self.write_raw("{\n");
                    self.indent();
                    self.pad();
                    self.write_value(inner)?;
                    self.write_raw("\n");
                    self.dedent();
                    self.pad();
                    self.write_raw("}");
                } else {
                    self.write_raw("{}");
                }
            },
            BinValue::Map { items, .. } => {
                if items.is_empty() {
                    self.write_raw("{}");
                } else {
                    self.write_raw("{\n");
                    self.indent();
                    for (key, value) in items {
                        self.pad();
                        self.write_value(key)?;
                        self.write_raw(" = ");
                        self.write_value(value)?;
                        self.write_raw("\n");
                    }
                    self.dedent();
                    self.pad();
                    self.write_raw("}");
                }
            },
            BinValue::Pointer { name, name_str, items } => {
                if *name == 0 && items.is_empty() {
                    self.write_raw("null");
                } else {
                    if let Some(s) = name_str {
                        self.write_raw(s);
                        self.write_raw(" ");
                    } else {
                        write!(self.buffer, "{:#x} ", name)?;
                    }
                    if items.is_empty() {
                        self.write_raw("{}");
                    } else {
                        self.write_raw("{\n");
                        self.indent();
                        for field in items {
                            self.pad();
                            if let Some(s) = &field.key_str {
                                self.write_raw(s);
                                self.write_raw(": ");
                            } else {
                                write!(self.buffer, "{:#x}: ", field.key)?;
                            }
                            self.write_type(&field.value);
                            self.write_raw(" = ");
                            self.write_value(&field.value)?;
                            self.write_raw("\n");
                        }
                        self.dedent();
                        self.pad();
                        self.write_raw("}");
                    }
                }
            },
            BinValue::Embed { name, name_str, items } => {
                if let Some(s) = name_str {
                    self.write_raw(s);
                    self.write_raw(" ");
                } else {
                    write!(self.buffer, "{:#x} ", name)?;
                }
                if items.is_empty() {
                    self.write_raw("{}");
                } else {
                    self.write_raw("{\n");
                    self.indent();
                    for field in items {
                        self.pad();
                        if let Some(s) = &field.key_str {
                            self.write_raw(s);
                            self.write_raw(": ");
                        } else {
                            write!(self.buffer, "{:#x}: ", field.key)?;
                        }
                        self.write_type(&field.value);
                        self.write_raw(" = ");
                        self.write_value(&field.value)?;
                        self.write_raw("\n");
                    }
                    self.dedent();
                    self.pad();
                    self.write_raw("}");
                }
            },
        }
        Ok(())
    }
}

use nom::{
    IResult,
    branch::alt,
    bytes::complete::{tag, take_while1, take_until, is_not},
    character::complete::{char, multispace1, digit1, hex_digit1, one_of},
    combinator::{map, opt, value, map_res},
    multi::{many0, separated_list0},
    sequence::{delimited, preceded, terminated, tuple, pair},
};

type ParseResult<'a, T> = IResult<&'a str, T>;

// ============================================================================
// Basic Parsers
// ============================================================================

/// Parse whitespace and comments
fn ws(input: &str) -> ParseResult<()> {
    value(
        (),
        many0(alt((
            value((), multispace1),
            value((), pair(char('#'), alt((take_until("\n"), take_while1(|_| true))))),
        )))
    )(input)
}

/// Parse an identifier (alphanumeric + underscore)
fn identifier(input: &str) -> ParseResult<&str> {
    preceded(
        ws,
        take_while1(|c: char| c.is_alphanumeric() || c == '_')
    )(input)
}

/// Parse a word (can include +, -, .)
fn word(input: &str) -> ParseResult<&str> {
    preceded(
        ws,
        take_while1(|c: char| c.is_alphanumeric() || c == '_' || c == '+' || c == '-' || c == '.')
    )(input)
}

/// Parse a quoted string with escape sequences
fn quoted_string(input: &str) -> ParseResult<String> {
    preceded(
        ws,
        alt((
            delimited(
                char('"'),
                map(
                    many0(alt((
                        map(is_not("\\\""), |s: &str| s.to_string()),
                        map(preceded(char('\\'), one_of("nrt\\\"'")), |c| {
                            match c {
                                'n' => "\n".to_string(),
                                'r' => "\r".to_string(),
                                't' => "\t".to_string(),
                                '\\' => "\\".to_string(),
                                '"' => "\"".to_string(),
                                '\'' => "'".to_string(),
                                _ => c.to_string(),
                            }
                        }),
                    ))),
                    |parts| parts.join("")
                ),
                char('"')
            ),
            delimited(
                char('\''),
                map(
                    many0(alt((
                        map(is_not("\\'"), |s: &str| s.to_string()),
                        map(preceded(char('\\'), one_of("nrt\\\"'")), |c| {
                            match c {
                                'n' => "\n".to_string(),
                                'r' => "\r".to_string(),
                                't' => "\t".to_string(),
                                '\\' => "\\".to_string(),
                                '"' => "\"".to_string(),
                                '\'' => "'".to_string(),
                                _ => c.to_string(),
                            }
                        }),
                    ))),
                    |parts| parts.join("")
                ),
                char('\'')
            ),
        ))
    )(input)
}

/// Parse a hex u32 (0x12345678)
fn hex_u32(input: &str) -> ParseResult<u32> {
    preceded(
        ws,
        alt((
            map_res(
                preceded(alt((tag("0x"), tag("0X"))), hex_digit1),
                |s| u32::from_str_radix(s, 16)
            ),
            map_res(digit1, |s: &str| s.parse::<u32>()),
        ))
    )(input)
}

/// Parse a hex u64 (0x123456789abcdef0)
fn hex_u64(input: &str) -> ParseResult<u64> {
    preceded(
        ws,
        alt((
            map_res(
                preceded(alt((tag("0x"), tag("0X"))), hex_digit1),
                |s| u64::from_str_radix(s, 16)
            ),
            map_res(digit1, |s: &str| s.parse::<u64>()),
        ))
    )(input)
}

/// Parse a boolean
fn parse_bool(input: &str) -> ParseResult<bool> {
    preceded(
        ws,
        alt((
            value(true, tag("true")),
            value(false, tag("false")),
        ))
    )(input)
}

/// Parse a number of any type
fn parse_number<T: std::str::FromStr>(input: &str) -> ParseResult<T> {
    map_res(word, |s| s.parse::<T>())(input)
}

// ============================================================================
// Type Parsers
// ============================================================================

/// Parse a type name
fn parse_type_name(input: &str) -> ParseResult<BinType> {
    map_res(word, |s| s.parse::<BinType>())(input)
}

/// Parse container type: list[type], map[key,value], option[type]
fn parse_container_type(input: &str) -> ParseResult<(BinType, Option<BinType>)> {
    preceded(
        ws,
        delimited(
            char('['),
            alt((
                // map[key,value]
                map(
                    tuple((
                        parse_type_name,
                        preceded(tuple((ws, char(','), ws)), parse_type_name),
                    )),
                    |(k, v)| (k, Some(v))
                ),
                // list[type] or option[type]
                map(parse_type_name, |t| (t, None)),
            )),
            preceded(ws, char(']'))
        )
    )(input)
}

// ============================================================================
// Value Parsers
// ============================================================================

/// Parse a vec2: { x, y }
fn parse_vec2(input: &str) -> ParseResult<[f32; 2]> {
    delimited(
        preceded(ws, char('{')),
        map(
            tuple((
                parse_number::<f32>,
                preceded(tuple((ws, char(','), ws)), parse_number::<f32>),
            )),
            |(x, y)| [x, y]
        ),
        preceded(ws, char('}'))
    )(input)
}

/// Parse a vec3: { x, y, z }
fn parse_vec3(input: &str) -> ParseResult<[f32; 3]> {
    delimited(
        preceded(ws, char('{')),
        map(
            tuple((
                parse_number::<f32>,
                preceded(tuple((ws, char(','), ws)), parse_number::<f32>),
                preceded(tuple((ws, char(','), ws)), parse_number::<f32>),
            )),
            |(x, y, z)| [x, y, z]
        ),
        preceded(ws, char('}'))
    )(input)
}

/// Parse a vec4: { x, y, z, w }
fn parse_vec4(input: &str) -> ParseResult<[f32; 4]> {
    delimited(
        preceded(ws, char('{')),
        map(
            tuple((
                parse_number::<f32>,
                preceded(tuple((ws, char(','), ws)), parse_number::<f32>),
                preceded(tuple((ws, char(','), ws)), parse_number::<f32>),
                preceded(tuple((ws, char(','), ws)), parse_number::<f32>),
            )),
            |(x, y, z, w)| [x, y, z, w]
        ),
        preceded(ws, char('}'))
    )(input)
}

/// Parse a mtx44: { 16 floats }
fn parse_mtx44(input: &str) -> ParseResult<[f32; 16]> {
    delimited(
        preceded(ws, char('{')),
        map(
            tuple((
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                parse_number::<f32>,
                preceded(tuple((ws, opt(char(',')), ws)), parse_number::<f32>),
            )),
            |(m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15)| {
                [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15]
            }
        ),
        preceded(ws, char('}'))
    )(input)
}

/// Parse rgba: { r, g, b, a }
fn parse_rgba(input: &str) -> ParseResult<[u8; 4]> {
    delimited(
        preceded(ws, char('{')),
        map(
            tuple((
                parse_number::<u8>,
                preceded(tuple((ws, char(','), ws)), parse_number::<u8>),
                preceded(tuple((ws, char(','), ws)), parse_number::<u8>),
                preceded(tuple((ws, char(','), ws)), parse_number::<u8>),
            )),
            |(r, g, b, a)| [r, g, b, a]
        ),
        preceded(ws, char('}'))
    )(input)
}

/// Parse a hash (hex or quoted string)
fn parse_hash(input: &str) -> ParseResult<BinValue> {
    preceded(
        ws,
        alt((
            map(quoted_string, |s| {
                let h = crate::hash::fnv1a(&s);
                BinValue::Hash { value: h, name: Some(s) }
            }),
            map(hex_u32, |h| BinValue::Hash { value: h, name: None }),
        ))
    )(input)
}

/// Parse a file hash (hex or quoted string)
fn parse_file(input: &str) -> ParseResult<BinValue> {
    preceded(
        ws,
        alt((
            map(quoted_string, |s| {
                let h = crate::hash::Xxh64::new(&s).0;
                BinValue::File { value: h, name: Some(s) }
            }),
            map(hex_u64, |h| BinValue::File { value: h, name: None }),
        ))
    )(input)
}

/// Parse a link hash (hex or quoted string)
fn parse_link(input: &str) -> ParseResult<BinValue> {
    preceded(
        ws,
        alt((
            map(quoted_string, |s| {
                let h = crate::hash::fnv1a(&s);
                BinValue::Link { value: h, name: Some(s) }
            }),
            map(hex_u32, |h| BinValue::Link { value: h, name: None }),
        ))
    )(input)
}

/// Parse a list: { item1, item2, ... }
fn parse_list(input: &str, value_type: BinType, is_list2: bool) -> ParseResult<BinValue> {
    let (input, items) = delimited(
        preceded(ws, char('{')),
        map(
            opt(terminated(
                separated_list0(
                    preceded(ws, char(',')),
                    |i| parse_value(i, value_type, None)
                ),
                opt(preceded(ws, char(',')))
            )),
            |opt_items| opt_items.unwrap_or_default()
        ),
        preceded(ws, char('}'))
    )(input)?;

    if is_list2 {
        Ok((input, BinValue::List2 { value_type, items }))
    } else {
        Ok((input, BinValue::List { value_type, items }))
    }
}

/// Parse an option: {} or { value }
fn parse_option(input: &str, value_type: BinType) -> ParseResult<BinValue> {
    let (input, item) = delimited(
        preceded(ws, char('{')),
        opt(|i| parse_value(i, value_type, None)),
        preceded(ws, char('}'))
    )(input)?;

    Ok((input, BinValue::Option {
        value_type,
        item: item.map(Box::new)
    }))
}

/// Parse a map: { key1 = val1, key2 = val2, ... }
fn parse_map(input: &str, key_type: BinType, value_type: BinType) -> ParseResult<BinValue> {
    let (input, items) = delimited(
        preceded(ws, char('{')),
        map(
            opt(terminated(
                separated_list0(
                    preceded(ws, char(',')),
                    tuple((
                        |i| parse_value(i, key_type, None),
                        preceded(tuple((ws, char('='), ws)), |i| parse_value(i, value_type, None)),
                    ))
                ),
                opt(preceded(ws, char(',')))
            )),
            |opt_items| opt_items.unwrap_or_default()
        ),
        preceded(ws, char('}'))
    )(input)?;

    Ok((input, BinValue::Map { key_type, value_type, items }))
}

/// Parse a field: key: type = value
fn parse_field(input: &str) -> ParseResult<crate::model::Field> {
    let (input, key_str) = word(input)?;
    let (key, key_str_opt) = if key_str.starts_with("0x") || key_str.starts_with("0X") {
        (u32::from_str_radix(&key_str[2..], 16).unwrap_or(0), None)
    } else {
        (crate::hash::fnv1a(key_str), Some(key_str.to_string()))
    };

    let (input, _) = preceded(ws, char(':'))(input)?;
    let (input, field_type) = parse_type_name(input)?;
    
    // Handle container types
    let (input, type_info) = if field_type.is_container() {
        let (input, ti) = parse_container_type(input)?;
        (input, Some(ti))
    } else {
        (input, None)
    };

    let (input, _) = preceded(ws, char('='))(input)?;
    let (input, value) = parse_value(input, field_type, type_info)?;

    Ok((input, crate::model::Field { key, key_str: key_str_opt, value }))
}

/// Parse an embed: name { field1: type = value, ... }
fn parse_embed(input: &str) -> ParseResult<BinValue> {
    let (input, name_str) = word(input)?;
    let (name, name_opt) = if name_str.starts_with("0x") || name_str.starts_with("0X") {
        (u32::from_str_radix(&name_str[2..], 16).unwrap_or(0), None)
    } else {
        (crate::hash::fnv1a(name_str), Some(name_str.to_string()))
    };

    let (input, items) = delimited(
        preceded(ws, char('{')),
        map(
            opt(terminated(
                separated_list0(
                    opt(preceded(ws, char(','))),
                    parse_field
                ),
                opt(preceded(ws, char(',')))
            )),
            |opt_items| opt_items.unwrap_or_default()
        ),
        preceded(ws, char('}'))
    )(input)?;

    Ok((input, BinValue::Embed { name, name_str: name_opt, items }))
}

/// Parse a pointer: name { field1: type = value, ... } or null
fn parse_pointer(input: &str) -> ParseResult<BinValue> {
    preceded(
        ws,
        alt((
            value(BinValue::Pointer { name: 0, name_str: None, items: vec![] }, tag("null")),
            |input| {
                let (input, name_str) = word(input)?;
                let (name, name_opt) = if name_str == "null" {
                    (0, None)
                } else if name_str.starts_with("0x") || name_str.starts_with("0X") {
                    (u32::from_str_radix(&name_str[2..], 16).unwrap_or(0), None)
                } else {
                    (crate::hash::fnv1a(name_str), Some(name_str.to_string()))
                };

                let (input, items) = if name == 0 {
                    (input, vec![])
                } else {
                    delimited(
                        preceded(ws, char('{')),
                        map(
                            opt(terminated(
                                separated_list0(
                                    opt(preceded(ws, char(','))),
                                    parse_field
                                ),
                                opt(preceded(ws, char(',')))
                            )),
                            |opt_items| opt_items.unwrap_or_default()
                        ),
                        preceded(ws, char('}'))
                    )(input)?
                };

                Ok((input, BinValue::Pointer { name, name_str: name_opt, items }))
            }
        ))
    )(input)
}

/// Main value parser
fn parse_value<'a>(input: &'a str, bin_type: BinType, type_info: Option<(BinType, Option<BinType>)>) -> ParseResult<'a, BinValue> {
    match bin_type {
        BinType::None => map(preceded(ws, tag("null")), |_| BinValue::None)(input),
        BinType::Bool => map(parse_bool, BinValue::Bool)(input),
        BinType::I8 => map(parse_number, BinValue::I8)(input),
        BinType::U8 => map(parse_number, BinValue::U8)(input),
        BinType::I16 => map(parse_number, BinValue::I16)(input),
        BinType::U16 => map(parse_number, BinValue::U16)(input),
        BinType::I32 => map(parse_number, BinValue::I32)(input),
        BinType::U32 => map(hex_u32, BinValue::U32)(input),
        BinType::I64 => map(parse_number, BinValue::I64)(input),
        BinType::U64 => map(hex_u64, BinValue::U64)(input),
        BinType::F32 => map(parse_number, BinValue::F32)(input),
        BinType::Vec2 => map(parse_vec2, BinValue::Vec2)(input),
        BinType::Vec3 => map(parse_vec3, BinValue::Vec3)(input),
        BinType::Vec4 => map(parse_vec4, BinValue::Vec4)(input),
        BinType::Mtx44 => map(parse_mtx44, BinValue::Mtx44)(input),
        BinType::Rgba => map(parse_rgba, BinValue::Rgba)(input),
        BinType::String => map(quoted_string, BinValue::String)(input),
        BinType::Hash => parse_hash(input),
        BinType::File => parse_file(input),
        BinType::Link => parse_link(input),
        BinType::Flag => map(parse_bool, BinValue::Flag)(input),
        BinType::List => {
            let (inner_type, _) = type_info.ok_or_else(|| {
                nom::Err::Failure(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
            })?;
            parse_list(input, inner_type, false)
        },
        BinType::List2 => {
            let (inner_type, _) = type_info.ok_or_else(|| {
                nom::Err::Failure(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
            })?;
            parse_list(input, inner_type, true)
        },
        BinType::Option => {
            let (inner_type, _) = type_info.ok_or_else(|| {
                nom::Err::Failure(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
            })?;
            parse_option(input, inner_type)
        },
        BinType::Map => {
            let (key_type, value_type) = type_info.ok_or_else(|| {
                nom::Err::Failure(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
            })?;
            let value_type = value_type.ok_or_else(|| {
                nom::Err::Failure(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
            })?;
            parse_map(input, key_type, value_type)
        },
        BinType::Pointer => parse_pointer(input),
        BinType::Embed => parse_embed(input),
    }
}

// ============================================================================
// Top-Level Parsers
// ============================================================================

/// Parse a section: key: type = value
fn parse_section(input: &str) -> ParseResult<(String, BinValue)> {
    preceded(
        ws,
        |input| {
            let (input, key) = identifier(input)?;
            let (input, _) = preceded(ws, char(':'))(input)?;
            let (input, bin_type) = parse_type_name(input)?;

            // Handle container types
            let (input, type_info) = if bin_type.is_container() {
                let (input, ti) = parse_container_type(input)?;
                (input, Some(ti))
            } else {
                (input, None)
            };

            let (input, _) = preceded(ws, char('='))(input)?;
            let (input, value) = parse_value(input, bin_type, type_info)?;

            Ok((input, (key.to_string(), value)))
        }
    )(input)
}

/// Parse the entire bin file
fn parse_bin(input: &str) -> ParseResult<Bin> {
    let (input, _) = ws(input)?;
    let (input, sections) = many0(parse_section)(input)?;
    let (input, _) = ws(input)?;

    let mut bin = Bin::new();
    for (key, value) in sections {
        bin.sections.insert(key, value);
    }

    Ok((input, bin))
}

// ============================================================================
// Public API
// ============================================================================

pub fn read_text(data: &str) -> Result<Bin, String> {
    match parse_bin(data) {
        Ok((remaining, bin)) => {
            let trimmed = remaining.trim();
            if !trimmed.is_empty() {
                Err(format!("Unexpected content after parsing: {}", trimmed))
            } else {
                Ok(bin)
            }
        }
        Err(nom::Err::Error(e)) | Err(nom::Err::Failure(e)) => {
            Err(format!("Parse error at position: {:?}", e))
        }
        Err(nom::Err::Incomplete(_)) => {
            Err("Incomplete input".to_string())
        }
    }
}

fn get_bin_type_name(t: BinType) -> &'static str {
    match t {
        BinType::None => "none",
        BinType::Bool => "bool",
        BinType::I8 => "i8",
        BinType::U8 => "u8",
        BinType::I16 => "i16",
        BinType::U16 => "u16",
        BinType::I32 => "i32",
        BinType::U32 => "u32",
        BinType::I64 => "i64",
        BinType::U64 => "u64",
        BinType::F32 => "f32",
        BinType::Vec2 => "vec2",
        BinType::Vec3 => "vec3",
        BinType::Vec4 => "vec4",
        BinType::Mtx44 => "mtx44",
        BinType::Rgba => "rgba",
        BinType::String => "string",
        BinType::Hash => "hash",
        BinType::File => "file",
        BinType::List => "list",
        BinType::List2 => "list2",
        BinType::Pointer => "pointer",
        BinType::Embed => "embed",
        BinType::Link => "link",
        BinType::Option => "option",
        BinType::Map => "map",
        BinType::Flag => "flag",
    }
}

fn get_type_name(v: &BinValue) -> &'static str {
    match v {
        BinValue::None => "none",
        BinValue::Bool(_) => "bool",
        BinValue::I8(_) => "i8",
        BinValue::U8(_) => "u8",
        BinValue::I16(_) => "i16",
        BinValue::U16(_) => "u16",
        BinValue::I32(_) => "i32",
        BinValue::U32(_) => "u32",
        BinValue::I64(_) => "i64",
        BinValue::U64(_) => "u64",
        BinValue::F32(_) => "f32",
        BinValue::Vec2(_) => "vec2",
        BinValue::Vec3(_) => "vec3",
        BinValue::Vec4(_) => "vec4",
        BinValue::Mtx44(_) => "mtx44",
        BinValue::Rgba(_) => "rgba",
        BinValue::String(_) => "string",
        BinValue::Hash { .. } => "hash",
        BinValue::File { .. } => "file",
        BinValue::List { .. } => "list",
        BinValue::List2 { .. } => "list2",
        BinValue::Pointer { .. } => "pointer",
        BinValue::Embed { .. } => "embed",
        BinValue::Link { .. } => "link",
        BinValue::Option { .. } => "option",
        BinValue::Map { .. } => "map",
        BinValue::Flag(_) => "flag",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Bin;

    #[test]
    fn test_write_text_basic() {
        let mut bin = Bin::new();
        bin.sections.insert("type".to_string(), BinValue::String("PROP".to_string()));
        bin.sections.insert("version".to_string(), BinValue::U32(1));
        
        let text = write_text(&bin).unwrap();
        assert!(text.contains("#PROP_text"));
        assert!(text.contains("type: string = \"PROP\""));
        assert!(text.contains("version: u32 = 1"));
    }

    #[test]
    fn test_read_text_basic() {
        let text = r#"
#PROP_text
type: string = "PROP"
version: u32 = 1
"#;
        let bin = read_text(text).unwrap();
        assert_eq!(bin.sections.get("type"), Some(&BinValue::String("PROP".to_string())));
        assert_eq!(bin.sections.get("version"), Some(&BinValue::U32(1)));
    }
}
