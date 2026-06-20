#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window_config = app
                .config()
                .app
                .windows
                .first()
                .cloned()
                .expect("at least one window must be configured");
            tauri::WebviewWindowBuilder::from_config(app, &window_config)?
                .on_web_resource_request(|request, response| {
                    let uri = request.uri().to_string();
                    if request.uri().path().ends_with(".glb") || uri.contains(".glb") {
                        response.headers_mut().insert(
                            tauri::http::header::CONTENT_TYPE,
                            tauri::http::HeaderValue::from_static("model/gltf-binary"),
                        );
                    }
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
