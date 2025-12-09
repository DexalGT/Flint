# LoL Modding Suite

A League of Legends modding library built with Rust and Tauri.

## Features

- **Hash Management** - Automatically downloads and manages hash tables from CommunityDragon
- **WAD Operations** - Reads and extracts WAD archives
- **Bin Conversion** - Parses and converts binary property files

## Project Structure

```
lol-modding-suite/
├── src-tauri/          # Rust backend
│   ├── src/
│   │   ├── commands/   # Tauri command handlers
│   │   ├── core/       # Core functionality
│   │   ├── error.rs    # Error types
│   │   ├── state.rs    # Application state
│   │   └── main.rs     # Entry point
│   ├── Cargo.toml      # Rust dependencies
│   └── tauri.conf.json # Tauri configuration
├── src/                # Frontend (to be implemented)
└── package.json        # Node dependencies
```

## Development

### Prerequisites

- Rust (latest stable)
- Node.js (v18+)
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## License

TBD
