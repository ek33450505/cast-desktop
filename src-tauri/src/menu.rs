use tauri::{
    menu::{
        Menu, MenuBuilder, MenuEvent, MenuItem, PredefinedMenuItem, SubmenuBuilder,
    },
    AppHandle, Emitter, Manager, Runtime,
};
use tauri_plugin_shell::ShellExt;

/// Build the full native macOS menu for Cast Desktop.
///
/// NOTE: Cmd+W is intentionally absent from all menu items. EditorTabs.tsx
/// owns the Cmd+W binding for tab-close via useHotkeys. If Cmd+W were placed
/// here, macOS would intercept it at the OS level before the WKWebView keydown
/// event fires, breaking tab-close. See lib.rs for the original comment.
pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    // ── App menu ("Cast Desktop") ─────────────────────────────────────────────
    let about = MenuItem::with_id(app, "about", "About Cast Desktop", true, None::<&str>)?;
    let app_menu = SubmenuBuilder::new(app, "Cast Desktop")
        .item(&about)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    // ── File ──────────────────────────────────────────────────────────────────
    // Cmd+T — new tab (menu owns, removes useHotkeys in TerminalTabs.tsx)
    // Cmd+O — open folder (menu owns, removes useHotkeys in EditorShellLayout)
    // Cmd+S — save file (menu owns, removes addEventListener in EditorShellLayout)
    // NOTE: Cmd+W deliberately absent — owned by EditorTabs.tsx useHotkeys.
    let new_tab = MenuItem::with_id(app, "new-tab", "New Tab", true, Some("CmdOrCtrl+T"))?;
    let open_folder =
        MenuItem::with_id(app, "open-folder", "Open Folder…", true, Some("CmdOrCtrl+O"))?;
    let save_file = MenuItem::with_id(app, "save-file", "Save", true, Some("CmdOrCtrl+S"))?;
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_tab)
        .item(&open_folder)
        .item(&save_file)
        .build()?;

    // ── Edit (predefined roles) ───────────────────────────────────────────────
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    // ── View ──────────────────────────────────────────────────────────────────
    // Cmd+B and Cmd+Alt+B — menu owns; removes useHotkeys in App.tsx ShellLayout.
    let toggle_left =
        MenuItem::with_id(app, "toggle-left-rail", "Toggle Left Rail", true, Some("CmdOrCtrl+B"))?;
    let toggle_right = MenuItem::with_id(
        app,
        "toggle-right-rail",
        "Toggle Right Rail",
        true,
        Some("CmdOrCtrl+Alt+B"),
    )?;
    let toggle_appearance =
        MenuItem::with_id(app, "toggle-appearance", "Toggle Appearance", true, None::<&str>)?;
    let toggle_devtools = MenuItem::with_id(
        app,
        "toggle-devtools",
        "Toggle DevTools",
        true,
        Some("CmdOrCtrl+Alt+I"),
    )?;
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&toggle_left)
        .item(&toggle_right)
        .separator()
        .item(&toggle_appearance)
        .separator()
        .item(&toggle_devtools)
        .build()?;

    // ── Tabs ──────────────────────────────────────────────────────────────────
    // Cmd+Shift+] / Cmd+Shift+[ — menu owns; removes useHotkeys in TerminalTabs.tsx.
    let next_tab = MenuItem::with_id(
        app,
        "next-tab",
        "Next Tab",
        true,
        Some("CmdOrCtrl+Shift+]"),
    )?;
    let prev_tab = MenuItem::with_id(
        app,
        "prev-tab",
        "Previous Tab",
        true,
        Some("CmdOrCtrl+Shift+["),
    )?;
    let tabs_menu = SubmenuBuilder::new(app, "Tabs")
        .item(&next_tab)
        .item(&prev_tab)
        .build()?;

    // ── Window ────────────────────────────────────────────────────────────────
    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .build()?;

    // ── Help ──────────────────────────────────────────────────────────────────
    let github = MenuItem::with_id(app, "open-github", "Cast Desktop on GitHub", true, None::<&str>)?;
    let help_about = MenuItem::with_id(app, "help-about", "About Cast Desktop", true, None::<&str>)?;
    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&github)
        .item(&help_about)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&tabs_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()
}

/// Handle a native menu event, translating it into a front-end Tauri event.
/// The front-end bridge in App.tsx listens for "cast:menu" and re-dispatches
/// as a window event so existing in-app handlers can respond.
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let action = event.id().as_ref();

    match action {
        "toggle-devtools" => {
            // DevTools must be opened from the Rust side.
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(debug_assertions)]
                window.open_devtools();
                #[cfg(not(debug_assertions))]
                window.open_devtools();
            }
        }
        "open-github" => {
            // Open URL in default browser via shell plugin.
            // tauri_plugin_shell::Shell::open is the available API in this project's
            // Cargo.toml (tauri-plugin-opener is not wired). Suppress the deprecation
            // warning since switching plugins is out of scope for Phase C.
            #[allow(deprecated)]
            let _ = app.shell().open("https://github.com/ek33450505/cast-desktop", None);
        }
        _ => {
            // All other actions are forwarded to the front-end as a single
            // "cast:menu" event with the action id as payload.
            let _ = app.emit("cast:menu", action);
        }
    }
}
