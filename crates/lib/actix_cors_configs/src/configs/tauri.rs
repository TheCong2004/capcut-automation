use actix_cors::Cors;

pub fn add_tauri(cors: Cors, _is_production: bool) -> Cors {
  cors
      // Tauri Windows
      .allowed_origin("http://tauri.localhost")
      // Tauri Mac
      .allowed_origin("tauri://localhost")
}
