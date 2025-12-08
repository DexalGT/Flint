use crate::model::{Bin, BinType, BinValue, Field};
use serde_json::{Map, Value};
use std::str::FromStr;

pub fn write_json(bin: &Bin) -> Result<String, String> {
    let mut root = Map::new();
    for (key, value) in &bin.sections {
        let mut section = Map::new();
        section.insert("type".to_string(), Value::String(get_type_name(value).to_string()));
        section.insert("value".to_string(), bin_value_to_json(value));
        root.insert(key.clone(), Value::Object(section));
    }
    serde_json::to_string_pretty(&Value::Object(root)).map_err(|e| e.to_string())
}

pub fn read_json(data: &str) -> Result<Bin, String> {
    let root: Value = serde_json::from_str(data).map_err(|e| e.to_string())?;
    let root_obj = root.as_object().ok_or("Root must be an object")?;
    
    let mut bin = Bin::new();
    for (key, val) in root_obj {
        let val_obj = val.as_object().ok_or(format!("Section {} must be an object", key))?;
        let type_str = val_obj.get("type").and_then(|v| v.as_str()).ok_or(format!("Section {} missing type", key))?;
        let type_ = BinType::from_str(type_str).map_err(|_| format!("Unknown type: {}", type_str))?;
        
        let value_json = val_obj.get("value").ok_or(format!("Section {} missing value", key))?;
        let value = json_to_bin_value(value_json, type_)?;
        bin.sections.insert(key.clone(), value);
    }
    Ok(bin)
}

fn bin_value_to_json(value: &BinValue) -> Value {
    match value {
        BinValue::None => Value::Null,
        BinValue::Bool(v) => Value::Bool(*v),
        BinValue::I8(v) => Value::Number((*v).into()),
        BinValue::U8(v) => Value::Number((*v).into()),
        BinValue::I16(v) => Value::Number((*v).into()),
        BinValue::U16(v) => Value::Number((*v).into()),
        BinValue::I32(v) => Value::Number((*v).into()),
        BinValue::U32(v) => Value::Number((*v).into()),
        BinValue::I64(v) => Value::Number((*v).into()),
        BinValue::U64(v) => Value::Number((*v).into()),
        BinValue::F32(v) => serde_json::Number::from_f64(*v as f64).map(Value::Number).unwrap_or(Value::Null),
        BinValue::Vec2(v) => Value::Array(v.iter().map(|x| serde_json::Number::from_f64(*x as f64).map(Value::Number).unwrap_or(Value::Null)).collect()),
        BinValue::Vec3(v) => Value::Array(v.iter().map(|x| serde_json::Number::from_f64(*x as f64).map(Value::Number).unwrap_or(Value::Null)).collect()),
        BinValue::Vec4(v) => Value::Array(v.iter().map(|x| serde_json::Number::from_f64(*x as f64).map(Value::Number).unwrap_or(Value::Null)).collect()),
        BinValue::Mtx44(v) => Value::Array(v.iter().map(|x| serde_json::Number::from_f64(*x as f64).map(Value::Number).unwrap_or(Value::Null)).collect()),
        BinValue::Rgba(v) => Value::Array(v.iter().map(|x| Value::Number((*x).into())).collect()),
        BinValue::String(v) => Value::String(v.clone()),
        BinValue::Hash { value, name } => {
            if let Some(s) = name {
                Value::String(s.clone())
            } else {
                Value::Number((*value).into())
            }
        },
        BinValue::File { value, name } => {
            if let Some(s) = name {
                Value::String(s.clone())
            } else {
                Value::Number((*value).into())
            }
        },
        BinValue::Link { value, name } => {
            if let Some(s) = name {
                Value::String(s.clone())
            } else {
                Value::Number((*value).into())
            }
        },
        BinValue::Flag(v) => Value::Bool(*v),
        
        BinValue::List { value_type, items } | BinValue::List2 { value_type, items } => {
            let mut map = Map::new();
            map.insert("valueType".to_string(), Value::String(get_bin_type_name(*value_type).to_string()));
            let json_items: Vec<Value> = items.iter().map(|i| bin_value_to_json(i)).collect();
            map.insert("items".to_string(), Value::Array(json_items));
            Value::Object(map)
        },
        BinValue::Option { value_type, item } => {
            let mut map = Map::new();
            map.insert("valueType".to_string(), Value::String(get_bin_type_name(*value_type).to_string()));
            let mut json_items = Vec::new();
            if let Some(inner) = item {
                json_items.push(bin_value_to_json(inner));
            }
            map.insert("items".to_string(), Value::Array(json_items));
            Value::Object(map)
        },
        BinValue::Map { key_type, value_type, items } => {
            let mut map = Map::new();
            map.insert("keyType".to_string(), Value::String(get_bin_type_name(*key_type).to_string()));
            map.insert("valueType".to_string(), Value::String(get_bin_type_name(*value_type).to_string()));
            let mut json_items = Vec::new();
            for (k, v) in items {
                let mut item_map = Map::new();
                item_map.insert("key".to_string(), bin_value_to_json(k));
                item_map.insert("value".to_string(), bin_value_to_json(v));
                json_items.push(Value::Object(item_map));
            }
            map.insert("items".to_string(), Value::Array(json_items));
            Value::Object(map)
        },
        BinValue::Pointer { name, name_str, items } | BinValue::Embed { name, name_str, items } => {
            let mut map = Map::new();
            if let Some(s) = name_str {
                map.insert("name".to_string(), Value::String(s.clone()));
            } else {
                map.insert("name".to_string(), Value::Number((*name).into()));
            }
            let mut json_items = Vec::new();
            for field in items {
                let mut field_map = Map::new();
                if let Some(s) = &field.key_str {
                    field_map.insert("key".to_string(), Value::String(s.clone()));
                } else {
                    field_map.insert("key".to_string(), Value::Number(field.key.into()));
                }
                field_map.insert("type".to_string(), Value::String(get_type_name(&field.value).to_string()));
                field_map.insert("value".to_string(), bin_value_to_json(&field.value));
                json_items.push(Value::Object(field_map));
            }
            map.insert("items".to_string(), Value::Array(json_items));
            Value::Object(map)
        },
    }
}

fn json_to_bin_value(json: &Value, type_: BinType) -> Result<BinValue, String> {
    match type_ {
        BinType::None => Ok(BinValue::None),
        BinType::Bool => Ok(BinValue::Bool(json.as_bool().ok_or("Expected bool")?)),
        BinType::I8 => Ok(BinValue::I8(json.as_i64().ok_or("Expected number")? as i8)),
        BinType::U8 => Ok(BinValue::U8(json.as_u64().ok_or("Expected number")? as u8)),
        BinType::I16 => Ok(BinValue::I16(json.as_i64().ok_or("Expected number")? as i16)),
        BinType::U16 => Ok(BinValue::U16(json.as_u64().ok_or("Expected number")? as u16)),
        BinType::I32 => Ok(BinValue::I32(json.as_i64().ok_or("Expected number")? as i32)),
        BinType::U32 => Ok(BinValue::U32(json.as_u64().ok_or("Expected number")? as u32)),
        BinType::I64 => Ok(BinValue::I64(json.as_i64().ok_or("Expected number")?)),
        BinType::U64 => Ok(BinValue::U64(json.as_u64().ok_or("Expected number")?)),
        BinType::F32 => Ok(BinValue::F32(json.as_f64().ok_or("Expected number")? as f32)),
        BinType::Vec2 => {
            let arr = json.as_array().ok_or("Expected array")?;
            if arr.len() != 2 { return Err("Expected array of length 2".to_string()); }
            Ok(BinValue::Vec2([arr[0].as_f64().unwrap_or(0.0) as f32, arr[1].as_f64().unwrap_or(0.0) as f32]))
        },
        BinType::Vec3 => {
            let arr = json.as_array().ok_or("Expected array")?;
            if arr.len() != 3 { return Err("Expected array of length 3".to_string()); }
            Ok(BinValue::Vec3([arr[0].as_f64().unwrap_or(0.0) as f32, arr[1].as_f64().unwrap_or(0.0) as f32, arr[2].as_f64().unwrap_or(0.0) as f32]))
        },
        BinType::Vec4 => {
            let arr = json.as_array().ok_or("Expected array")?;
            if arr.len() != 4 { return Err("Expected array of length 4".to_string()); }
            Ok(BinValue::Vec4([arr[0].as_f64().unwrap_or(0.0) as f32, arr[1].as_f64().unwrap_or(0.0) as f32, arr[2].as_f64().unwrap_or(0.0) as f32, arr[3].as_f64().unwrap_or(0.0) as f32]))
        },
        BinType::Mtx44 => {
            let arr = json.as_array().ok_or("Expected array")?;
            if arr.len() != 16 { return Err("Expected array of length 16".to_string()); }
            let mut m = [0.0; 16];
            for i in 0..16 { m[i] = arr[i].as_f64().unwrap_or(0.0) as f32; }
            Ok(BinValue::Mtx44(m))
        },
        BinType::Rgba => {
            let arr = json.as_array().ok_or("Expected array")?;
            if arr.len() != 4 { return Err("Expected array of length 4".to_string()); }
            Ok(BinValue::Rgba([arr[0].as_u64().unwrap_or(0) as u8, arr[1].as_u64().unwrap_or(0) as u8, arr[2].as_u64().unwrap_or(0) as u8, arr[3].as_u64().unwrap_or(0) as u8]))
        },
        BinType::String => Ok(BinValue::String(json.as_str().ok_or("Expected string")?.to_string())),
        BinType::Hash => {
            if let Some(s) = json.as_str() {
                Ok(BinValue::Hash { value: crate::hash::fnv1a(s), name: Some(s.to_string()) })
            } else {
                Ok(BinValue::Hash { value: json.as_u64().ok_or("Expected hash")? as u32, name: None })
            }
        },
        BinType::File => {
            if let Some(s) = json.as_str() {
                Ok(BinValue::File { value: crate::hash::Xxh64::new(s).0, name: Some(s.to_string()) })
            } else {
                Ok(BinValue::File { value: json.as_u64().ok_or("Expected file hash")?, name: None })
            }
        },
        BinType::Link => {
            if let Some(s) = json.as_str() {
                Ok(BinValue::Link { value: crate::hash::fnv1a(s), name: Some(s.to_string()) })
            } else {
                Ok(BinValue::Link { value: json.as_u64().ok_or("Expected link hash")? as u32, name: None })
            }
        },
        BinType::Flag => Ok(BinValue::Flag(json.as_bool().ok_or("Expected bool")?)),
        
        BinType::List | BinType::List2 => {
            let obj = json.as_object().ok_or("Expected object for list")?;
            let value_type_str = obj.get("valueType").and_then(|v| v.as_str()).ok_or("Missing valueType")?;
            let value_type = BinType::from_str(value_type_str).map_err(|_| "Unknown valueType")?;
            let items_arr = obj.get("items").and_then(|v| v.as_array()).ok_or("Missing items")?;
            let mut items = Vec::new();
            for item in items_arr {
                items.push(json_to_bin_value(item, value_type)?);
            }
            if type_ == BinType::List {
                Ok(BinValue::List { value_type, items })
            } else {
                Ok(BinValue::List2 { value_type, items })
            }
        },
        BinType::Option => {
            let obj = json.as_object().ok_or("Expected object for option")?;
            let value_type_str = obj.get("valueType").and_then(|v| v.as_str()).ok_or("Missing valueType")?;
            let value_type = BinType::from_str(value_type_str).map_err(|_| "Unknown valueType")?;
            let items_arr = obj.get("items").and_then(|v| v.as_array()).ok_or("Missing items")?;
            let item = if items_arr.is_empty() {
                None
            } else {
                Some(Box::new(json_to_bin_value(&items_arr[0], value_type)?))
            };
            Ok(BinValue::Option { value_type, item })
        },
        BinType::Map => {
            let obj = json.as_object().ok_or("Expected object for map")?;
            let key_type_str = obj.get("keyType").and_then(|v| v.as_str()).ok_or("Missing keyType")?;
            let value_type_str = obj.get("valueType").and_then(|v| v.as_str()).ok_or("Missing valueType")?;
            let key_type = BinType::from_str(key_type_str).map_err(|_| "Unknown keyType")?;
            let value_type = BinType::from_str(value_type_str).map_err(|_| "Unknown valueType")?;
            let items_arr = obj.get("items").and_then(|v| v.as_array()).ok_or("Missing items")?;
            let mut items = Vec::new();
            for item in items_arr {
                let item_obj = item.as_object().ok_or("Expected object for map item")?;
                let k = json_to_bin_value(item_obj.get("key").ok_or("Missing key")?, key_type)?;
                let v = json_to_bin_value(item_obj.get("value").ok_or("Missing value")?, value_type)?;
                items.push((k, v));
            }
            Ok(BinValue::Map { key_type, value_type, items })
        },
        BinType::Pointer | BinType::Embed => {
            let obj = json.as_object().ok_or("Expected object for class")?;
            let name_json = obj.get("name").ok_or("Missing name")?;
            let (name, name_str) = if let Some(s) = name_json.as_str() {
                (crate::hash::fnv1a(s), Some(s.to_string()))
            } else {
                (name_json.as_u64().unwrap_or(0) as u32, None)
            };
            
            let items_arr = obj.get("items").and_then(|v| v.as_array()).ok_or("Missing items")?;
            let mut items = Vec::new();
            for item in items_arr {
                let item_obj = item.as_object().ok_or("Expected object for field")?;
                let key_json = item_obj.get("key").ok_or("Missing key")?;
                let (key, key_str) = if let Some(s) = key_json.as_str() {
                    (crate::hash::fnv1a(s), Some(s.to_string()))
                } else {
                    (key_json.as_u64().unwrap_or(0) as u32, None)
                };
                
                let type_str = item_obj.get("type").and_then(|v| v.as_str()).ok_or("Missing field type")?;
                let field_type = BinType::from_str(type_str).map_err(|_| "Unknown field type")?;
                let value = json_to_bin_value(item_obj.get("value").ok_or("Missing value")?, field_type)?;
                
                items.push(Field { key, key_str, value });
            }
            
            if type_ == BinType::Pointer {
                Ok(BinValue::Pointer { name, name_str, items })
            } else {
                Ok(BinValue::Embed { name, name_str, items })
            }
        },
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
    use crate::model::{Bin, BinType, BinValue};

    #[test]
    fn test_json_round_trip() {
        let mut bin = Bin::new();
        bin.sections.insert("test".to_string(), BinValue::U32(123));
        bin.sections.insert("list".to_string(), BinValue::List { 
            value_type: BinType::U32, 
            items: vec![BinValue::U32(1), BinValue::U32(2)] 
        });
        
        let json = write_json(&bin).unwrap();
        let bin2 = read_json(&json).unwrap();
        
        assert_eq!(bin.sections.len(), bin2.sections.len());
        if let Some(BinValue::U32(v)) = bin2.sections.get("test") {
            assert_eq!(*v, 123);
        } else {
            panic!("Expected U32");
        }
        
        if let Some(BinValue::List { value_type, items }) = bin2.sections.get("list") {
            assert_eq!(*value_type, BinType::U32);
            assert_eq!(items.len(), 2);
        } else {
            panic!("Expected List");
        }
    }
}
