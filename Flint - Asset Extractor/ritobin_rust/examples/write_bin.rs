//! Example: Write a bin file
//!
//! This example shows how to create a bin file from scratch and write it.

use ritobin_rust::binary::write_bin;
use ritobin_rust::model::{Bin, BinValue};
use std::error::Error;
use std::fs;

fn main() -> Result<(), Box<dyn Error>> {
    println!("Creating a new bin file...");

    // Create a new bin file
    let mut bin = Bin::new();

    // Add sections
    bin.sections.insert("type".to_string(), BinValue::String("PROP".to_string()));
    bin.sections.insert("version".to_string(), BinValue::U32(3));
    bin.sections.insert("name".to_string(), BinValue::String("ExampleChampion".to_string()));
    bin.sections.insert("hp".to_string(), BinValue::F32(580.0));
    bin.sections.insert("mana".to_string(), BinValue::F32(350.0));

    // Add a vector
    bin.sections.insert(
        "position".to_string(),
        BinValue::Vec3([100.0, 200.0, 300.0]),
    );

    // Add a list
    bin.sections.insert(
        "abilities".to_string(),
        BinValue::List {
            value_type: ritobin_rust::model::BinType::String,
            items: vec![
                BinValue::String("Q - Ability1".to_string()),
                BinValue::String("W - Ability2".to_string()),
                BinValue::String("E - Ability3".to_string()),
                BinValue::String("R - Ultimate".to_string()),
            ],
        },
    );

    println!("Created bin with {} sections", bin.sections.len());

    // Write to file
    let output_path = "example_output.bin";
    let bytes = write_bin(&bin)?;
    fs::write(output_path, bytes)?;

    println!("✓ Written to: {}", output_path);
    println!("\nYou can read it back with:");
    println!("  cargo run --example read_bin -- {}", output_path);

    Ok(())
}
