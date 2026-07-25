//! actix_cors_configs
//!
//! Handle FakeYou.com, Storyteller.ai, development environments, and our other
//! domains in a cross-cutting library.
//!

// Never allow these
#![forbid(private_bounds)]
#![forbid(private_interfaces)]
#![forbid(unused_must_use)] // NB: It's unsafe to not close/check some things

// Okay to toggle
#![forbid(unreachable_patterns)]
#![forbid(unused_imports)]
#![forbid(unused_mut)]
#![forbid(unused_variables)]

// Always allow
#![allow(dead_code)]
#![allow(non_snake_case)]

pub mod cors;
pub mod shared_array_buffer_cors;

pub (crate) mod configs;
pub (crate) mod util;

#[cfg(test)]
pub (crate) mod testing;
