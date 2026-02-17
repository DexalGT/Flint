use std::path::PathBuf;

fn main() {
    tauri_build::build();
    build_ritobin_lsp();
}

/// Compile ritobin-lsp from the sibling directory and copy the binary into
/// src-tauri/binaries/ so Tauri can bundle it as a sidecar.
///
/// Looks for the LSP workspace in:
///   ../../ritobin-lsp
///   ../../ritobin-lsp-ritobin-lsp-vs-v0.0.3   (downloaded release folder)
fn build_ritobin_lsp() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());

    // src-tauri/ -> Flint - Asset Extractor/ -> e:\RitoShark\Flint\
    let flint_root = match manifest_dir.parent().and_then(|p| p.parent()) {
        Some(p) => p.to_path_buf(),
        None => return,
    };

    let lsp_root = ["ritobin-lsp", "ritobin-lsp-ritobin-lsp-vs-v0.0.3"]
        .iter()
        .map(|name| flint_root.join(name))
        .find(|p| p.join("Cargo.toml").exists());

    let lsp_root = match lsp_root {
        Some(p) => p,
        None => {
            println!("cargo:warning=ritobin-lsp source not found, LSP will be unavailable");
            return;
        }
    };

    // Re-run build.rs only when LSP sources change
    println!("cargo:rerun-if-changed={}", lsp_root.join("crates").display());

    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());
    let is_release = std::env::var("PROFILE").as_deref() == Ok("release");

    let mut cmd = std::process::Command::new(&cargo);
    cmd.args(["build", "--manifest-path"])
        .arg(lsp_root.join("Cargo.toml"))
        .args(["--package", "ritobin-lsp"]);
    if is_release {
        cmd.arg("--release");
    }

    let status = cmd.status().expect("failed to invoke cargo for ritobin-lsp");
    if !status.success() {
        println!("cargo:warning=ritobin-lsp build failed, LSP will be unavailable");
        return;
    }

    let profile_dir = if is_release { "release" } else { "debug" };
    let src = lsp_root.join("target").join(profile_dir).join("ritobin-lsp.exe");

    if !src.exists() {
        println!("cargo:warning=ritobin-lsp.exe not found at {}", src.display());
        return;
    }

    // Tauri sidecar naming: {name}-{target-triple}.exe
    let target = std::env::var("TARGET").unwrap_or_else(|_| "x86_64-pc-windows-msvc".to_string());
    let binaries_dir = manifest_dir.join("binaries");
    std::fs::create_dir_all(&binaries_dir).ok();

    let dst = binaries_dir.join(format!("ritobin-lsp-{}.exe", target));
    if let Err(e) = std::fs::copy(&src, &dst) {
        println!("cargo:warning=failed to copy ritobin-lsp binary: {}", e);
    }
}
