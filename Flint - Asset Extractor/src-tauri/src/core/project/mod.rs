// Project management module exports
pub mod mod_project;
pub mod project;

pub use mod_project::{ModProject, ModProjectLayer, default_layers};
pub use project::{create_project, open_project, save_project, Project};
