use actix_cors::Cors;
use crate::util::netlify_branch_domain_matches::netlify_branch_domain_matches;

pub fn add_artcraft_2d(cors: Cors, _is_production: bool) -> Cors {
  cors
      // Hypothetical domains
      .allowed_origin("https://2d.storyteller.ai")
      .allowed_origin("https://2d.getartcraft.com")
      // Netlify project
      .allowed_origin_fn(|origin, _req_head| {
        netlify_branch_domain_matches(origin, "storyteller-2d.netlify.app")
      })
      // Tauri localhost (2D engine, first three ports)
      .allowed_origin("http://localhost:5741")
      .allowed_origin("http://localhost:5742") // If already started
      .allowed_origin("http://localhost:5743") // If already started
}
