use tauri::command;

/// 回傳應用程式版本號
#[command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 開啟音訊檔案選擇對話框，回傳選擇的檔案路徑
#[command]
pub async fn open_audio_file() -> Result<Option<String>, String> {
    // 透過 tauri-plugin-dialog 處理（前端呼叫）
    Ok(None)
}

/// 儲存音訊檔案
#[command]
pub async fn save_audio_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| e.to_string())
}

/// 檢查後端 FastAPI 服務是否健康
#[command]
pub async fn check_backend_health() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client
        .get("http://localhost:8765/health")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}
