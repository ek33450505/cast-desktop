use parking_lot::Mutex;
use portable_pty::{Child, MasterPty};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;

pub struct PtySession {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn MasterPty + Send>,
    /// Held for its Drop impl — killing the child process when removed from the store.
    #[allow(dead_code)]
    pub child: Box<dyn Child + Send + Sync>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub name: String,
    pub shell: String,
    pub created_at: u64,
}

pub struct SessionStore {
    pub sessions: Mutex<HashMap<String, PtySession>>,
    pub metadata: Mutex<HashMap<String, SessionInfo>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            metadata: Mutex::new(HashMap::new()),
        }
    }

    pub fn get_child_pid(&self, session_id: &str) -> Option<u32> {
        self.sessions.lock()
            .get(session_id)
            .and_then(|s| s.child.process_id())
    }
}

