use actix_cors::Cors;

pub fn add_power_stream(cors: Cors, is_production: bool) -> Cors {
  // TODO: Remove non-SSL "http://" from production in safe rollout
  if is_production {
    cors
        .allowed_origin("https://dash.power.stream")
        .allowed_origin("https://power.stream")
  } else {
    cors
        .allowed_origin("http://dev.dash.power.stream")
        .allowed_origin("http://dev.power.stream")
        .allowed_origin("https://dev.dash.power.stream")
        .allowed_origin("https://dev.power.stream")
  }
}

pub fn add_legacy_storyteller_stream(cors: Cors, is_production: bool) -> Cors {
  // TODO: Remove non-SSL "http://" from production in safe rollout
  if is_production {
    cors
        // Storyteller.stream (Production)
        .allowed_origin("http://api.storyteller.stream")
        .allowed_origin("http://obs.storyteller.stream")
        .allowed_origin("http://storyteller.stream")
        .allowed_origin("http://ws.storyteller.stream")
        .allowed_origin("https://api.storyteller.stream")
        .allowed_origin("https://obs.storyteller.stream")
        .allowed_origin("https://storyteller.stream")
        .allowed_origin("https://ws.storyteller.stream")
        // Storyteller.stream (Staging)
        .allowed_origin("http://staging.obs.storyteller.stream")
        .allowed_origin("http://staging.storyteller.stream")
        .allowed_origin("https://staging.obs.storyteller.stream")
        .allowed_origin("https://staging.storyteller.stream")
        // Legacy "create.storyteller.ai" (Production)
        .allowed_origin("http://create.storyteller.ai")
        .allowed_origin("http://obs.storyteller.ai")
        .allowed_origin("http://ws.storyteller.ai")
        .allowed_origin("https://create.storyteller.ai")
        .allowed_origin("https://obs.storyteller.ai")
        .allowed_origin("https://ws.storyteller.ai")
  } else {
    cors // NB: None!
  }
}

pub fn add_legacy_vocodes(cors: Cors, is_production: bool) -> Cors {
  if is_production {
    cors
        // Vocodes (Production)
        .allowed_origin("https://api.vo.codes")
        .allowed_origin("https://vo.codes")
        .allowed_origin("https://vocodes.com")
  } else {
    cors
        // Vocodes (Development)
        .allowed_origin("http://dev.api.vo.codes")
        .allowed_origin("http://dev.vo.codes")
        .allowed_origin("https://dev.api.vo.codes")
        .allowed_origin("https://dev.vo.codes")
  }
}

pub fn add_legacy_trumped(cors: Cors, is_production: bool) -> Cors {
  if is_production {
    cors
        // Trumped (Production)
        .allowed_origin("https://trumped.com")
  } else {
    cors
        // Trumped (Development)
        .allowed_origin("http://dev.trumped.com")
        .allowed_origin("https://dev.trumped.com")
  }
}

