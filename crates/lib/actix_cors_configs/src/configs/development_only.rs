use std::net::Ipv4Addr;

use actix_cors::Cors;
use log::warn;
use url::{Host, Url};

pub fn add_development_only(cors: Cors) -> Cors {
  // Any localhost is allowed.
  cors.allowed_origin_fn(|origin, _req_head| {
        let maybe_url = origin.to_str()
            .map(|origin| Url::parse(origin));

        let url = match maybe_url {
          Ok(Ok(url)) => url,
          _ => {
            warn!("Invalid origin: {:?}", origin);
            return false
          },
        };

        match url.host() {
          Some(Host::Domain("localhost")) => true,
          Some(Host::Ipv4(Ipv4Addr::LOCALHOST)) => true,
          _ => false,
        }
      })
}
