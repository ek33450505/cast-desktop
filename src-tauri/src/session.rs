use parking_lot::Mutex;
use portable_pty::{Child, MasterPty};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use tauri::State;

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

#[tauri::command]
pub fn session_list(state: State<SessionStore>) -> Vec<SessionInfo> {
    state.metadata.lock().values().cloned().collect()
}

#[tauri::command]
pub fn session_rename(
    session_id: String,
    name: String,
    state: State<SessionStore>,
) -> Result<(), String> {
    let mut metadata = state.metadata.lock();
    let entry = metadata
        .get_mut(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    entry.name = name;
    Ok(())
}

#[tauri::command]
pub fn session_create_metadata(
    session_id: String,
    name: String,
    shell: String,
    state: State<SessionStore>,
) {
    use std::time::SystemTime;
    let created_at = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let info = SessionInfo {
        id: session_id.clone(),
        name,
        shell,
        created_at,
    };
    state.metadata.lock().insert(session_id, info);
}
