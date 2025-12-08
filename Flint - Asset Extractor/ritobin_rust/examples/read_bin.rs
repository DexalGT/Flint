//! Basic example: Read a binary file
//!
//! This example shows how to read a `.bin` file and access its data.

use ritobin_rust::binary::read_bin;
use std::error::Error;
use std::fs;

fn main() -> Result<(), Box<dyn Error>> {
    // Read the binary file
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <file.bin>", args[0]);
        eprintln!("\nExample:");
        eprintln!("  cargo run --example read_bin -- path/to/file.bin");
        std::process::exit(1);
    }

    let path = &args[1];
    println!("Reading bin file: {}", path);

    let data = fs::read(path)?;
    let bin = read_bin(&data)?;

    // Print file statistics
    println!("\n=== Bin File Statistics ===");
    println!("Sections: {}", bin.sections.len());
    
    // Show all section names
    println!("\n=== Sections ===");
    for (name, _value) in &bin.sections {
        println!("  - {}", name);
    }

    // Try to print version if it exists
    if let Some(version) = bin.sections.get("version") {
        println!("\n=== File Version ===");
        println!("{:?}", version);
    }

    println!("\n✓ Successfully read bin file");
    Ok(())
}
