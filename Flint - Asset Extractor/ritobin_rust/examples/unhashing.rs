//! Example: Unhashing with hash files
//!
//! This example shows how to load hash files and unhash a bin file
//! to replace numeric hashes with human-readable names.

use ritobin_rust::binary::read_bin;
use ritobin_rust::unhash::BinUnhasher;
use std::error::Error;
use std::fs;

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: {} <hash_dir> <file.bin>", args[0]);
        eprintln!("\nThe hash_dir should contain files like:");
        eprintln!("  - hashes.game.txt (or .bin)");
        eprintln!("  - hashes.binentries.txt");
        eprintln!("  - hashes.binhashes.txt");
        eprintln!("\nExample:");
        eprintln!("  cargo run --example unhashing -- ./hashes champion.bin");
        std::process::exit(1);
    }

    let hash_dir = &args[1];
    let bin_path = &args[2];

    println!("Loading hash files from: {}", hash_dir);

    // Create unhasher and load hash files
    let mut unhasher = BinUnhasher::new();
    
    // List of common hash files to try
    let hash_files = [
        "hashes.game.txt",
        "hashes.binentries.txt",
        "hashes.binhashes.txt",
        "hashes.bintypes.txt",
        "hashes.binfields.txt",
    ];

    let mut loaded_count = 0;
    for file in hash_files {
        let path = format!("{}/{}", hash_dir, file);
        // load_auto tries .bin first, then .txt
        if let Ok(()) = unhasher.load_auto(&path) {
            println!("  ✓ Loaded: {}", file);
            loaded_count += 1;
        }
    }

    println!("\n✓ Loaded {} hash file(s)", loaded_count);

    // Read and unhash the bin file
    println!("\nReading bin file: {}", bin_path);
    let data = fs::read(bin_path)?;
    let mut bin = read_bin(&data)?;

    println!("Sections before unhashing: {}", bin.sections.len());

    // Unhash
    unhasher.unhash_bin(&mut bin);

    println!("\n✓ Unhashing complete!");
    println!("\nYou can now convert to text format to see unhashed names:");
    println!("  cargo run -- {} output.py", bin_path);

    Ok(())
}
