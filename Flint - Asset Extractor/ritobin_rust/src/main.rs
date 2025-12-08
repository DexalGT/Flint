use clap::{Parser, Subcommand, ValueEnum};
use std::path::{Path, PathBuf};
use ritobin_rust::binary::{read_bin, write_bin};
use walkdir::WalkDir;

#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, ValueEnum, Debug)]
enum Format {
    Bin,
    Json,
    Text,
}

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Input file or directory (used if no subcommand)
    #[arg(global = true)]
    input: Option<PathBuf>,
    
    /// Output file or directory (optional)
    #[arg(short, long, global = true)]
    output: Option<PathBuf>,

    /// Directory to load hashes from
    #[arg(short = 'd', long, global = true)]
    dir: Option<PathBuf>,

    /// Recursive directory processing
    #[arg(short, long, global = true)]
    recursive: bool,

    /// Keep hashed values (don't unhash)
    #[arg(short = 'k', long, global = true)]
    keep_hashed: bool,

    /// Verbose output
    #[arg(short, long, global = true)]
    verbose: bool,

    /// Explicit input format
    #[arg(short = 'i', long, global = true)]
    input_format: Option<Format>,

    /// Explicit output format
    #[arg(long, global = true)]
    output_format: Option<Format>,
}


#[derive(Subcommand)]
enum Commands {
    /// Convert text hash files to binary format (10-50x faster loading)
    ConvertHashes {
        /// Input text hash file(s)
        input: Vec<PathBuf>,
        
        /// Output binary file (if single input) or directory (if multiple)
        #[arg(short, long)]
        output: Option<PathBuf>,
        
        /// Verbose output
        #[arg(short, long)]
        verbose: bool,
    },
    
    /// Convert bin files between formats
    Convert {
        /// Input file or directory
        input: PathBuf,
        
        /// Output file or directory
        #[arg(short, long)]
        output: Option<PathBuf>,
        
        /// Recursive directory processing
        #[arg(short, long)]
        recursive: bool,
        
        /// Verbose output
        #[arg(short, long)]
        verbose: bool,
    },
    
    /// Show information about a bin file
    Info {
        /// Input bin file
        input: PathBuf,
        
        /// Show detailed field information
        #[arg(short = 'D', long)]
        detailed: bool,
    },
    
    /// Validate bin file structure
    Validate {
        /// Input bin file(s) or directory
        input: PathBuf,
        
        /// Recursive directory validation
        #[arg(short, long)]
        recursive: bool,
    },
}


fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::ConvertHashes { input, output, verbose }) => {
            convert_hashes_command(input, output.as_deref(), *verbose)?;
        }
        Some(Commands::Info { input, detailed }) => {
            info_command(input, *detailed)?;
        }
        Some(Commands::Validate { input, recursive }) => {
            validate_command(input, *recursive)?;
        }
        Some(Commands::Convert { input, output, recursive, verbose }) => {
            // Similar to default behavior but explicit
            // Similar to default behavior but explicit
            let unhasher = setup_unhasher(&cli);

            if input.is_dir() {
                if !recursive {
                    return Err("Input is a directory but --recursive is not specified".into());
                }
                process_directory(input, output.as_deref(), &cli, &mut unhasher)?;
            } else {
                process_file(input, output.as_deref(), &cli, &mut unhasher)?;
            }
        }
        None => {
            // Default behavior - convert bin files
            // This handles drag-and-drop scenarios on Windows
            let input = cli.input.as_ref()
                .ok_or("Input file or directory required. Drag and drop files onto the executable or use: ritobin_rust <file.bin>")?;

            // Check if this looks like a drag-and-drop scenario
            // (single file, no explicit output or format specified)
            let is_drag_drop = input.is_file() 
                && cli.output.is_none() 
                && cli.output_format.is_none()
                && !cli.keep_hashed;

            if is_drag_drop {
                // Drag-and-drop mode: convert bin -> py in same directory
                println!("🎯 Drag-and-drop mode: Converting {} to text format...", input.display());
                
                // Load hashes if available
                // Load hashes if available
                let unhasher = setup_unhasher(&cli);

                // Process the file
                let data = std::fs::read(input)?;
                let mut bin = read_bin(&data)?;
                
                // Unhash
                if let Some(u) = &unhasher {
                    u.unhash_bin(&mut bin);
                }
                
                // Output to same directory with .py extension
                let output_path = input.with_extension("py");
                let text = ritobin_rust::text::write_text(&bin)?;
                std::fs::write(&output_path, text)?;
                
                println!("✓ Converted to: {}", output_path.display());
                println!("\nPress Enter to exit...");
                let mut _input = String::new();
                std::io::stdin().read_line(&mut _input).ok();
                
                return Ok(());
            }

            // Standard mode with full options
            // Standard mode with full options
            let unhasher = setup_unhasher(&cli);

            if input.is_dir() {
                if !cli.recursive {
                    return Err("Input is a directory but --recursive is not specified".into());
                }
                process_directory(input, cli.output.as_deref(), &cli, &mut unhasher)?;
            } else {
                process_file(input, cli.output.as_deref(), &cli, &mut unhasher)?;
            }
        }

    }
    
    Ok(())
}

fn convert_hashes_command(
    inputs: &[PathBuf],
    output: Option<&Path>,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    use ritobin_rust::unhash::BinUnhasher;

    if inputs.is_empty() {
        return Err("No input files specified".into());
    }

    if inputs.len() == 1 {
        // Single file conversion
        let input = &inputs[0];
        let output_path = if let Some(out) = output {
            out.to_path_buf()
        } else {
            // Default: replace .txt with .bin
            let mut p = input.clone();
            p.set_extension("bin");
            p
        };

        if verbose {
            println!("Converting {} to {}", input.display(), output_path.display());
        }

        let count = BinUnhasher::convert_text_to_binary(
            input.to_str().unwrap(),
            output_path.to_str().unwrap(),
        )?;

        println!("✓ Converted {} hashes to {}", count, output_path.display());
    } else {
        // Multiple files
        let output_dir = output.ok_or("Output directory required for multiple inputs")?;
        std::fs::create_dir_all(output_dir)?;

        let mut total_count = 0;
        for input in inputs {
            let output_path = output_dir.join(
                input.file_name().unwrap()
            ).with_extension("bin");

            if verbose {
                println!("Converting {} to {}", input.display(), output_path.display());
            }

            let count = BinUnhasher::convert_text_to_binary(
                input.to_str().unwrap(),
                output_path.to_str().unwrap(),
            )?;

            total_count += count;
            println!("✓ Converted {} hashes from {}", count, input.display());
        }

        println!("\n✓ Total: {} hashes converted", total_count);
    }

    Ok(())
}

fn setup_unhasher(cli: &Cli) -> Option<ritobin_rust::unhash::BinUnhasher> {
    if cli.keep_hashed {
        return None;
    }

    let mut unhasher = ritobin_rust::unhash::BinUnhasher::new();
    let mut loaded = false;

    // 1. Explicit directory (highest priority)
    if let Some(dir) = &cli.dir {
        if dir.exists() {
             if load_hashes(&mut unhasher, dir, cli.verbose) {
                 loaded = true;
             }
        } else {
             eprintln!("Warning: Specified hash directory does not exist: {}", dir.display());
        }
    } 
    
    // 2. Auto-discovery (if no explicit dir provided)
    if !loaded && cli.dir.is_none() {
        // Try AppData
        if let Ok(appdata) = std::env::var("APPDATA") {
            let path = PathBuf::from(appdata).join("RitoShark/Requirements/Hashes");
            if path.exists() {
                if cli.verbose { println!("Checking hash path: {}", path.display()); }
                if load_hashes(&mut unhasher, &path, cli.verbose) {
                    loaded = true;
                }
            }
        }

        // Try Executable Directory (Root)
        if !loaded {
            if let Ok(exe_path) = std::env::current_exe() {
                if let Some(root) = exe_path.parent() {
                    // Try "Hashes" folder in root
                    let hashes_dir = root.join("Hashes");
                    if hashes_dir.exists() {
                        if cli.verbose { println!("Checking hash path: {}", hashes_dir.display()); }
                        if load_hashes(&mut unhasher, &hashes_dir, cli.verbose) {
                            loaded = true;
                        }
                    }
                    
                    // Try root itself if still not loaded
                    if !loaded {
                        if cli.verbose { println!("Checking hash path: {}", root.display()); }
                        if load_hashes(&mut unhasher, root, cli.verbose) {
                            loaded = true;
                        }
                    }
                }
            }
        }
    }
    
    // 3. Prompt if nothing found
    if !loaded && cli.dir.is_none() {
        eprintln!("⚠️  No hashes found.");
        eprintln!("Checked: %APPDATA%/RitoShark/Requirements/Hashes");
        eprintln!("Checked: Executable directory (and /Hashes subdirectory)");
        eprint!("\nDo you want to continue without unhashing? [y/N]: ");
        use std::io::Write;
        std::io::stdout().flush().ok();
        
        let mut input = String::new();
        std::io::stdin().read_line(&mut input).ok();
        if input.trim().to_lowercase() != "y" {
            std::process::exit(0);
        }
    }

    Some(unhasher)
}

fn load_hashes(unhasher: &mut ritobin_rust::unhash::BinUnhasher, dir: &Path, verbose: bool) -> bool {
    let files = [
        "hashes.game.txt",
        "hashes.binentries.txt",
        "hashes.binhashes.txt",
        "hashes.bintypes.txt",
        "hashes.binfields.txt",
        "hashes.lcu.txt",
    ];
    
    let mut loaded_any = false;
    for file in files {
        let path = dir.join(file);
        if path.exists() {
            if let Some(path_str) = path.to_str() {
                if verbose { println!("Loading hashes from {}", path_str); }
                // Use auto-loading which tries binary first, then text
                match unhasher.load_auto(path_str) {
                    Ok(_) => loaded_any = true,
                    Err(e) => {
                        if verbose {
                            eprintln!("Warning: Failed to load {}: {}", path_str, e);
                        }
                    }
                }
            }
        }
    }
    loaded_any
}

fn process_directory(
    input_dir: &Path, 
    output_dir: Option<&Path>, 
    cli: &Cli, 
    unhasher: &mut Option<ritobin_rust::unhash::BinUnhasher>
) -> Result<(), Box<dyn std::error::Error>> {
    for entry in WalkDir::new(input_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            // Determine relative path to mirror structure if output_dir is set
            let relative_path = path.strip_prefix(input_dir).unwrap_or(path);
            let output_path = if let Some(out_dir) = output_dir {
                Some(out_dir.join(relative_path))
            } else {
                None
            };
            
            if let Err(e) = process_file(path, output_path.as_deref(), cli, unhasher) {
                if cli.verbose {
                    eprintln!("Skipping {}: {}", path.display(), e);
                }
            }
        }
    }
    Ok(())
}

fn process_file(
    input_path: &Path, 
    output_path: Option<&Path>, 
    cli: &Cli, 
    unhasher: &mut Option<ritobin_rust::unhash::BinUnhasher>
) -> Result<(), Box<dyn std::error::Error>> {
    let data = std::fs::read(input_path)?;
    
    // Detect input format
    let input_format = if let Some(fmt) = cli.input_format {
        fmt
    } else {
        detect_format(&data, input_path)
    };

    if cli.verbose {
        println!("Processing {} as {:?}", input_path.display(), input_format);
    }

    let mut bin = match input_format {
        Format::Bin => read_bin(&data)?,
        Format::Json => {
            let s = String::from_utf8(data)?;
            ritobin_rust::json::read_json(&s)?
        },
        Format::Text => {
            // Text reading not fully implemented in read_text yet? 
            // Wait, read_text IS implemented in src/text.rs.
            // But main.rs previously only used read_bin or json.
            // Let's check if read_text is exposed.
            // src/text.rs has `read_text`.
            let s = String::from_utf8(data)?;
            ritobin_rust::text::read_text(&s)?
        },
    };

    // Unhash if needed
    if let Some(u) = unhasher {
        u.unhash_bin(&mut bin);
    }

    // Determine output format
    let output_format = if let Some(fmt) = cli.output_format {
        fmt
    } else if let Some(out) = output_path {
        detect_format_from_extension(out)
    } else {
        // Infer from input
        match input_format {
            Format::Bin => Format::Text, // Default bin -> py
            Format::Json => Format::Bin, // Default json -> bin
            Format::Text => Format::Bin, // Default py -> bin
        }
    };

    // Determine output path
    let final_output_path = if let Some(out) = output_path {
        // If output is a directory (and we are processing a single file), join filename
        // But process_directory handles mirroring.
        // Here we assume output_path is the target file path if provided.
        // Unless it's a directory?
        if out.is_dir() {
            let name = input_path.file_stem().unwrap_or_default();
            let ext = match output_format {
                Format::Bin => "bin",
                Format::Json => "json",
                Format::Text => "py",
            };
            out.join(format!("{}.{}", name.to_string_lossy(), ext))
        } else {
            // If explicit output path given, check if extension matches format?
            // User might want to save .py as .txt.
            // Just use it.
            // But if we are in recursive mode, process_directory constructs the path.
            // If output_path was constructed by process_directory, it might have original extension.
            // We should probably change extension.
            let mut p = out.to_path_buf();
            p.set_extension(match output_format {
                Format::Bin => "bin",
                Format::Json => "json",
                Format::Text => "py",
            });
            p
        }
    } else {
        let mut p = input_path.to_path_buf();
        p.set_extension(match output_format {
            Format::Bin => "bin",
            Format::Json => "json",
            Format::Text => "py",
        });
        p
    };

    // Create parent directories if needed
    if let Some(parent) = final_output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    if cli.verbose {
        println!("Writing to {} as {:?}", final_output_path.display(), output_format);
    }

    match output_format {
        Format::Bin => {
            let bytes = write_bin(&bin)?;
            std::fs::write(final_output_path, bytes)?;
        },
        Format::Json => {
            let s = ritobin_rust::json::write_json(&bin)?;
            std::fs::write(final_output_path, s)?;
        },
        Format::Text => {
            let s = ritobin_rust::text::write_text(&bin)?;
            std::fs::write(final_output_path, s)?;
        },
    }

    Ok(())
}

fn detect_format(data: &[u8], path: &Path) -> Format {
    if data.len() >= 4 && (&data[0..4] == b"PROP" || &data[0..4] == b"PTCH") {
        return Format::Bin;
    }
    
    // Check for #PROP_text
    if data.len() >= 10 && &data[0..10] == b"#PROP_text" {
        return Format::Text;
    }

    // Check extension
    if let Some(ext) = path.extension() {
        if ext == "bin" { return Format::Bin; }
        if ext == "json" { return Format::Json; }
        if ext == "py" { return Format::Text; }
    }

    // Fallback: try to parse as JSON?
    // Or assume Text if it looks like text?
    // For now default to Text if not binary magic.
    Format::Text
}

fn detect_format_from_extension(path: &Path) -> Format {
    if let Some(ext) = path.extension() {
        if ext == "bin" { return Format::Bin; }
        if ext == "json" { return Format::Json; }
        if ext == "py" { return Format::Text; }
    }
    Format::Text // Default
}

fn info_command(input: &Path, detailed: bool) -> Result<(), Box<dyn std::error::Error>> {
    use ritobin_rust::model::{BinValue, BinType};
    
    let data = std::fs::read(input)?;
    let bin = read_bin(&data)?;
    
    println!("=== Bin File Information ===");
    println!("File: {}", input.display());
    println!("Size: {} bytes", data.len());
    println!();
    
    println!("=== Sections ===");
    println!("Total sections: {}", bin.sections.len());
    println!();
    
    for (name, value) in &bin.sections {
        println!("  {}:", name);
        print_value_info(value, detailed, 2);
        println!();
    }
    
    Ok(())
}

fn print_value_info(value: &ritobin_rust::model::BinValue, detailed: bool, indent: usize) {
    use ritobin_rust::model::BinValue;
    let prefix = " ".repeat(indent);
    
    match value {
        BinValue::None => println!("{}Type: None", prefix),
        BinValue::Bool(v) => println!("{}Type: Bool, Value: {}", prefix, v),
        BinValue::I8(v) => println!("{}Type: I8, Value: {}", prefix, v),
        BinValue::U8(v) => println!("{}Type: U8, Value: {}", prefix, v),
        BinValue::I16(v) => println!("{}Type: I16, Value: {}", prefix, v),
        BinValue::U16(v) => println!("{}Type: U16, Value: {}", prefix, v),
        BinValue::I32(v) => println!("{}Type: I32, Value: {}", prefix, v),
        BinValue::U32(v) => println!("{}Type: U32, Value: {}", prefix, v),
        BinValue::I64(v) => println!("{}Type: I64, Value: {}", prefix, v),
        BinValue::U64(v) => println!("{}Type: U64, Value: {}", prefix, v),
        BinValue::F32(v) => println!("{}Type: F32, Value: {}", prefix, v),
        BinValue::Vec2(v) => println!("{}Type: Vec2, Value: {:?}", prefix, v),
        BinValue::Vec3(v) => println!("{}Type: Vec3, Value: {:?}", prefix, v),
        BinValue::Vec4(v) => println!("{}Type: Vec4, Value: {:?}", prefix, v),
        BinValue::Mtx44(_) => println!("{}Type: Mtx44 (4x4 matrix)", prefix),
        BinValue::Rgba(v) => println!("{}Type: Rgba, Value: {:?}", prefix, v),
        BinValue::String(v) => {
            if detailed {
                println!("{}Type: String, Value: {}", prefix, v);
            } else {
                let preview = if v.len() > 50 { format!("{}...", &v[..50]) } else { v.clone() };
                println!("{}Type: String, Length: {}, Preview: {}", prefix, v.len(), preview);
            }
        },
        BinValue::Hash { value, name } => {
            if let Some(n) = name {
                println!("{}Type: Hash, Value: 0x{:08x} ({})", prefix, value, n);
            } else {
                println!("{}Type: Hash, Value: 0x{:08x}", prefix, value);
            }
        },
        BinValue::File { value, name } => {
            if let Some(n) = name {
                println!("{}Type: File, Value: 0x{:016x} ({})", prefix, value, n);
            } else {
                println!("{}Type: File, Value: 0x{:016x}", prefix, value);
            }
        },
        BinValue::List { value_type, items } => {
            println!("{}Type: List<{:?}>, Count: {}", prefix, value_type, items.len());
            if detailed && !items.is_empty() {
                println!("{}  Items:", prefix);
                for (i, item) in items.iter().take(3).enumerate() {
                    println!("{}    [{}]:", prefix, i);
                    print_value_info(item, false, indent + 6);
                }
                if items.len() > 3 {
                    println!("{}    ... and {} more", prefix, items.len() - 3);
                }
            }
        },
        BinValue::List2 { value_type, items } => {
            println!("{}Type: List2<{:?}>, Count: {}", prefix, value_type, items.len());
        },
        BinValue::Pointer { name, name_str, items } => {
            if let Some(n) = name_str {
                println!("{}Type: Pointer ({}), Fields: {}", prefix, n, items.len());
            } else {
                println!("{}Type: Pointer (0x{:08x}), Fields: {}", prefix, name, items.len());
            }
        },
        BinValue::Embed { name, name_str, items } => {
            if let Some(n) = name_str {
                println!("{}Type: Embed ({}), Fields: {}", prefix, n, items.len());
            } else {
                println!("{}Type: Embed (0x{:08x}), Fields: {}", prefix, name, items.len());
            }
        },
        BinValue::Link { value, name } => {
            if let Some(n) = name {
                println!("{}Type: Link, Value: 0x{:08x} ({})", prefix, value, n);
            } else {
                println!("{}Type: Link, Value: 0x{:08x}", prefix, value);
            }
        },
        BinValue::Option { value_type, item } => {
            if item.is_some() {
                println!("{}Type: Option<{:?}>, Value: Some", prefix, value_type);
            } else {
                println!("{}Type: Option<{:?}>, Value: None", prefix, value_type);
            }
        },
        BinValue::Map { key_type, value_type, items } => {
            println!("{}Type: Map<{:?}, {:?}>, Count: {}", prefix, key_type, value_type, items.len());
        },
        BinValue::Flag(v) => println!("{}Type: Flag, Value: {}", prefix, v),
    }
}

fn validate_command(input: &Path, recursive: bool) -> Result<(), Box<dyn std::error::Error>> {
    if input.is_dir() {
        if !recursive {
            return Err("Input is a directory but --recursive is not specified".into());
        }
        validate_directory(input)?;
    } else {
        validate_single_file(input)?;
    }
    Ok(())
}

fn validate_directory(dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    use walkdir::WalkDir;
    
    let mut total = 0;
    let mut valid = 0;
    let mut invalid = 0;
    
    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("bin") {
            total += 1;
            match validate_single_file(path) {
                Ok(_) => valid += 1,
                Err(e) => {
                    invalid += 1;
                    eprintln!("✗ {}: {}", path.display(), e);
                }
            }
        }
    }
    
    println!("\n=== Validation Summary ===");
    println!("Total files: {}", total);
    println!("Valid: {}", valid);
    println!("Invalid: {}", invalid);
    
    if invalid > 0 {
        return Err(format!("{} file(s) failed validation", invalid).into());
    }
    
    Ok(())
}

fn validate_single_file(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let data = std::fs::read(path)?;
    
    // Try to read the file
    let bin = read_bin(&data)?;
    
    // Basic validation
    if bin.sections.is_empty() {
        return Err("File has no sections".into());
    }
    
    // Check for common sections
    let has_type = bin.sections.contains_key("type");
    let has_version = bin.sections.contains_key("version");
    
    println!("✓ {}", path.display());
    println!("  Sections: {}", bin.sections.len());
    if !has_type {
        println!("  Warning: Missing 'type' section");
    }
    if !has_version {
        println!("  Warning: Missing 'version' section");
    }
    
    Ok(())
}
