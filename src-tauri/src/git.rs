use serde::Serialize;
use std::process::Command;

#[derive(Serialize, Clone)]
pub struct GitStatus {
    pub branch: String,
    pub dirty: bool,
}

#[tauri::command]
pub fn get_git_status(cwd: String) -> Result<GitStatus, String> {
    // Resolve branch
    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("git failed: {}", e))?;

    if !branch_output.status.success() {
        return Err("Not a git repository".to_string());
    }

    let branch = String::from_utf8_lossy(&branch_output.stdout)
        .trim()
        .to_string();

    // Check dirty
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("git status failed: {}", e))?;

    let dirty = !status_output.stdout.is_empty();

    Ok(GitStatus { branch, dirty })
}
