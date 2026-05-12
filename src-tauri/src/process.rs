use std::process::Command;
use tauri::State;
use crate::session::SessionStore;

#[tauri::command]
pub fn get_default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}

/// Returns the name of the foreground process for a PTY session.
/// Strategy: get the child PID (the shell), find its children via
/// `pgrep -P <pid>`, then get the process name of the deepest child.
/// Falls back to the shell name if no children found.
#[tauri::command]
pub fn get_foreground_process(
    session_id: String,
    state: State<SessionStore>,
) -> Result<String, String> {
    let child_pid = state.get_child_pid(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    // Walk one level of children (shell -> foreground process)
    let foreground_pid = get_child_pid(child_pid).unwrap_or(child_pid);

    get_process_name(foreground_pid)
        .map_err(|e| e.to_string())
}

fn get_child_pid(parent_pid: u32) -> Option<u32> {
    let output = Command::new("pgrep")
        .args(["-P", &parent_pid.to_string()])
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    // Take the last child pid (most recently spawned = foreground)
    stdout.lines().last()?.trim().parse().ok()
}

fn get_process_name(pid: u32) -> Result<String, std::io::Error> {
    let output = Command::new("ps")
        .args(["-o", "comm=", "-p", &pid.to_string()])
        .output()?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
