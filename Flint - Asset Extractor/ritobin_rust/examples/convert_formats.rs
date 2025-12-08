//! Example: Convert between different formats
//!
//! This example demonstrates converting between bin, text, and JSON formats.

use ritobin_rust::{binary, json, text};
use std::error::Error;
use std::fs;

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: {} <input_file> <output_file>", args[0]);
        eprintln!("\nDetects format from file extension:");
        eprintln!("  .bin  - Binary format");
        eprintln!("  .py   - Text format");
        eprintln!("  .json - JSON format");
        eprintln!("\nExamples:");
        eprintln!("  cargo run --example convert_formats -- file.bin file.py");
        eprintln!("  cargo run --example convert_formats -- file.py file.json");
        eprintln!("  cargo run --example convert_formats -- file.json file.bin");
        std::process::exit(1);
    }

    let input_path = &args[1];
    let output_path = &args[2];

    println!("Converting: {} -> {}", input_path, output_path);

    // Read input
    let bin = if input_path.ends_with(".bin") {
        let data = fs::read(input_path)?;
        binary::read_bin(&data)?
    } else if input_path.ends_with(".py") {
        let text = fs::read_to_string(input_path)?;
        text::read_text(&text)?
    } else if input_path.ends_with(".json") {
        let json_str = fs::read_to_string(input_path)?;
        json::read_json(&json_str)?
    } else {
        return Err("Unknown input format. Use .bin, .py, or .json".into());
    };

    println!("✓ Read input file ({} sections)", bin.sections.len());

    // Write output
    if output_path.ends_with(".bin") {
        let bytes = binary::write_bin(&bin)?;
        fs::write(output_path, bytes)?;
    } else if output_path.ends_with(".py") {
        let text = text::write_text(&bin)?;
        fs::write(output_path, text)?;
    } else if output_path.ends_with(".json") {
        let json_str = json::write_json(&bin)?;
        fs::write(output_path, json_str)?;
    } else {
        return Err("Unknown output format. Use .bin, .py, or .json".into());
    }

    println!("✓ Wrote output file: {}", output_path);
    Ok(())
}
