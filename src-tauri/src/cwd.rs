use std::process::Command;
use tauri::State;
use crate::session::SessionStore;

#[tauri::command]
pub fn get_cwd(session_id: String, state: State<SessionStore>) -> Result<String, String> {
    let pid = state
        .get_child_pid(&session_id)
        .ok_or_else(|| format!("Session not found or no PID: {}", session_id))?;

    // lsof -a -p <pid> -d cwd -Fn  outputs "n<path>" on the second line
    let output = Command::new("lsof")
        .args(["-a", "-p", &pid.to_string(), "-d", "cwd", "-Fn"])
        .output()
        .map_err(|e| format!("lsof failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(path) = line.strip_prefix('n') {
            return Ok(path.to_string());
        }
    }

    Err("Could not parse cwd from lsof output".to_string())
}
