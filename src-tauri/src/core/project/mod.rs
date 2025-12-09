// Project management module exports
pub mod project;

// Re-export from ltk_mod_project for league-mod compatibility
pub use ltk_mod_project::{
    ModProject, ModProjectLayer, ModProjectAuthor, 
    ModProjectLicense, FileTransformer, default_layers
};
pub use project::{create_project, open_project, save_project, Project, FlintMetadata};
