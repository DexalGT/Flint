use parking_lot::Mutex;
use std::path::PathBuf;
use std::sync::Arc;
use crate::core::hash::Hashtable;
use crate::error::Result;

#[derive(Clone)]
pub struct HashtableState(pub Arc<Mutex<Option<Hashtable>>>);

impl HashtableState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
    
    pub fn init(&self, hash_dir: PathBuf) -> Result<()> {
        // Create hash directory if it doesn't exist
        std::fs::create_dir_all(&hash_dir)?;
        
        let mut state = self.0.lock();
        *state = Some(Hashtable::from_directory(hash_dir)?);
        Ok(())
    }
    
    pub fn len(&self) -> usize {
        self.0.lock().as_ref().map(|h| h.len()).unwrap_or(0)
    }
    
    /// Get a clone of the hashtable for use in extraction
    pub fn get_hashtable(&self) -> Option<Hashtable> {
        self.0.lock().clone()
    }
}
