use wasm_bindgen::prelude::*;

mod seven;
mod chithi_cryto;

pub use seven::*;
pub use chithi_cryto::*;

/// Initialize panic hooks so Rust panics appear in the browser console.
#[wasm_bindgen(start)]
fn _init_panic_hook() {
    console_error_panic_hook::set_once();
}
