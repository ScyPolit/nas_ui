mod fixtures;
mod utils;

use fixtures::{server, Error, TestServer};
use rstest::rstest;
use serde_json::Value;
use std::thread::sleep;
use std::time::Duration;

#[rstest]
fn storage_uses_real_filesystem_data(server: TestServer) -> Result<(), Error> {
    let url = server.url().join("__dufs__/storage")?;
    let mut data = Value::Null;
    for _ in 0..30 {
        data = serde_json::from_str(&reqwest::blocking::get(url.clone())?.text()?)?;
        if data["status"] == "ready" {
            break;
        }
        sleep(Duration::from_millis(100));
    }

    assert_eq!(data["status"], "ready");
    assert!(data["disk"]["total_bytes"].as_u64().unwrap_or_default() > 0);
    assert!(data["disk"]["free_bytes"].as_u64().unwrap_or_default() > 0);
    assert!(data["shared"]["file_count"].as_u64().unwrap_or_default() > 0);
    assert!(
        data["shared"]["directory_count"]
            .as_u64()
            .unwrap_or_default()
            > 0
    );
    assert_eq!(
        data["shared"]["categories"]
            .as_array()
            .map(Vec::len)
            .unwrap_or_default(),
        6
    );
    let serialized = serde_json::to_string(&data)?;
    assert!(!serialized.contains(&server.path().display().to_string()));
    Ok(())
}

#[rstest]
fn storage_supports_path_prefix(
    #[with(&["--path-prefix", "nas"])] server: TestServer,
) -> Result<(), Error> {
    let response = reqwest::blocking::get(server.url().join("nas/__dufs__/storage")?)?;
    assert_eq!(response.status(), 200);
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "application/json"
    );
    Ok(())
}

#[rstest]
fn image_thumbnail_is_generated(server: TestServer) -> Result<(), Error> {
    let image_path = server.path().join("preview.png");
    image::RgbaImage::from_pixel(320, 180, image::Rgba([71, 116, 232, 255])).save(&image_path)?;
    let response = reqwest::blocking::get(server.url().join("preview.png?thumbnail=96")?)?;
    assert_eq!(response.status(), 200);
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "image/webp"
    );
    assert!(!response.bytes()?.is_empty());
    Ok(())
}
