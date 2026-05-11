use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use std::io::Read;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::session::{PtySession, SessionInfo, SessionStore};
use std::time::SystemTime;

#[derive(Clone, Serialize)]
struct PtyOutputPayload {
    session_id: String,
    data: String,
}

#[tauri::command]
pub fn pty_create(
    shell: String,
    cols: u16,
    rows: u16,
    app_handle: AppHandle,
    state: State<SessionStore>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&shell);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| e.to_string())?;

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    let session = PtySession {
        writer,
        master: pair.master,
        child,
    };

    state.sessions.lock().insert(session_id.clone(), session);

    let info = SessionInfo {
        id: session_id.clone(),
        name: format!("Shell {}", state.metadata.lock().len() + 1),
        shell: shell.clone(),
        created_at: SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };
    state.metadata.lock().insert(session_id.clone(), info);

    let sid = session_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    eprintln!("[forge] PTY reader EOF for session {}", sid);
                    let _ = app_handle.emit(
                        &format!("session-exit-{}", sid),
                        serde_json::json!({ "session_id": sid, "reason": "eof" }),
                    );
                    break;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let payload = PtyOutputPayload {
                        session_id: sid.clone(),
                        data,
                    };
                    let event_name = format!("pty-output-{}", sid);
                    let _ = app_handle.emit(&event_name, payload);
                }
                Err(e) => {
                    eprintln!("[forge] PTY reader error for session {}: {}", sid, e);
                    break;
                }
            }
        }
    });

    Ok(session_id)
}

#[tauri::command]
pub fn pty_write(
    session_id: String,
    data: String,
    state: State<SessionStore>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    use std::io::Write;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<SessionStore>,
) -> Result<(), String> {
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn pty_kill(session_id: String, state: State<SessionStore>) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    let session = sessions
        .remove(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    drop(session);
    state.metadata.lock().remove(&session_id);

    Ok(())
}
