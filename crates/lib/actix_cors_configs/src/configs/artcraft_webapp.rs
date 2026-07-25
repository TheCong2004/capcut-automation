use actix_cors::Cors;
use crate::util::netlify_branch_domain_matches::netlify_branch_domain_matches;

pub fn add_artcraft_webapp(cors: Cors, _is_production: bool) -> Cors {
  cors
      // Actual domains
      .allowed_origin("https://app.getartcraft.com")
      // Netlify project
      .allowed_origin_fn(|origin, _req_head| {
        netlify_branch_domain_matches(origin, "artcraft-webapp.netlify.app")
      })
}
