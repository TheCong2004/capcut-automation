use actix_cors::Cors;
use crate::util::netlify_branch_domain_matches::netlify_branch_domain_matches;

pub fn add_artcraft_3d(cors: Cors, _is_production: bool) -> Cors {
  cors
      // Hypothetical domains
      .allowed_origin("https://3d.storyteller.ai")
      .allowed_origin("https://3d.getartcraft.com")
      // Netlify project
      .allowed_origin_fn(|origin, _req_head| {
        netlify_branch_domain_matches(origin, "storyteller-3d.netlify.app")
      })
      // Tauri localhost (3D engine, first three ports)
      .allowed_origin("http://localhost:5173")
      .allowed_origin("http://localhost:5174") // If already started
      .allowed_origin("http://localhost:5175") // If already started
      .allowed_origin("https://macaroni-1.tailce84f.ts.net") // TODO
      .allowed_origin("https://halide.tailce84f.ts.net") // TODO
      .allowed_origin("https://brandons-macbook-pro.taild62114.ts.net") // TODO
}
