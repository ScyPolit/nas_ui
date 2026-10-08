use assert_fs::fixture::TempDir;
use assert_fs::prelude::*;
use port_check::free_local_port;
use reqwest::Url;
use rstest::fixture;
use socket2::{Domain, Protocol, Socket, Type};
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr, SocketAddrV4, SocketAddrV6, TcpListener};
use std::process::{Child, Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

#[allow(dead_code)]
pub type Error = Box<dyn std::error::Error>;

#[allow(dead_code)]
pub const BIN_FILE: &str = "😀.bin";

/// File names for testing purpose
#[allow(dead_code)]
pub static FILES: &[&str] = &[
    "test.txt",
    "test.html",
    "index.html",
    #[cfg(not(target_os = "windows"))]
    "file\n1.txt",
    BIN_FILE,
];

/// Directory names for testing directory don't exist
#[allow(dead_code)]
pub static DIR_NO_FOUND: &str = "dir-no-found/";

/// Directory names for testing directory don't have index.html
#[allow(dead_code)]
pub static DIR_NO_INDEX: &str = "dir-no-index/";

/// Directory names for testing hidden
#[allow(dead_code)]
pub static DIR_GIT: &str = ".git/";

/// Directory names for testings assets override
#[allow(dead_code)]
pub static DIR_ASSETS: &str = "dir-assets/";

/// Directory names for testing purpose
#[allow(dead_code)]
pub static DIRECTORIES: &[&str] = &["dir1/", "dir2/", "dir3/", DIR_NO_INDEX, DIR_GIT, DIR_ASSETS];

/// Test fixture which creates a temporary directory with a few files and directories inside.
/// The directories also contain files.
#[fixture]
#[allow(dead_code)]
pub fn tmpdir() -> TempDir {
    let tmpdir = assert_fs::TempDir::new().expect("Couldn't create a temp dir for tests");
    for file in FILES {
        if *file == BIN_FILE {
            tmpdir.child(file).write_binary(b"bin\0\x00123").unwrap();
        } else {
            tmpdir
                .child(file)
                .write_str(&format!("This is {file}"))
                .unwrap();
        }
    }
    for directory in DIRECTORIES {
        if *directory == DIR_ASSETS {
            tmpdir
                .child(format!("{}{}", directory, "index.html"))
                .write_str("__ASSETS_PREFIX__index.js;<template id=\"index-data\">__INDEX_DATA__</template>")
                .unwrap();
        } else {
            for file in FILES {
                if *directory == DIR_NO_INDEX && *file == "index.html" {
                    continue;
                }
                if *file == BIN_FILE {
                    tmpdir
                        .child(format!("{directory}{file}"))
                        .write_binary(b"bin\0\x00123")
                        .unwrap();
                } else {
                    tmpdir
                        .child(format!("{directory}{file}"))
                        .write_str(&format!("This is {directory}{file}"))
                        .unwrap();
                }
            }
        }
    }
    tmpdir.child("dir4/hidden").touch().unwrap();
    tmpdir
        .child("content-types/bin.tar")
        .write_binary(b"\x7f\x45\x4c\x46\x02\x01\x00\x00")
        .unwrap();
    tmpdir
        .child("content-types/bin")
        .write_binary(b"\x7f\x45\x4c\x46\x02\x01\x00\x00")
        .unwrap();
    tmpdir
        .child("content-types/file-utf8.txt")
        .write_str("世界")
        .unwrap();
    tmpdir
        .child("content-types/file-gbk.txt")
        .write_binary(b"\xca\xc0\xbd\xe7")
        .unwrap();
    tmpdir
        .child("content-types/file")
        .write_str("世界")
        .unwrap();

    tmpdir
}

/// Get a free port.
#[fixture]
#[allow(dead_code)]
pub fn port() -> u16 {
    for _ in 0..50 {
        let port = free_local_port().expect("Couldn't find a free local port");
        let ipv4_addr = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, port));
        let ipv4 = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP)).unwrap();
        if ipv4.bind(&ipv4_addr.into()).is_err() {
            continue;
        }
        if TcpListener::bind("[::1]:0").is_ok() {
            let ipv6_addr = SocketAddr::V6(SocketAddrV6::new(Ipv6Addr::UNSPECIFIED, port, 0, 0));
            let ipv6 = Socket::new(Domain::IPV6, Type::STREAM, Some(Protocol::TCP)).unwrap();
            ipv6.set_only_v6(true).unwrap();
            if ipv6.bind(&ipv6_addr.into()).is_err() {
                continue;
            }
        }
        return port;
    }
    panic!("Couldn't find a port available for both IPv4 and IPv6")
}

/// Run dufs as a server; Start with a temporary directory, a free port and some
/// optional arguments then wait for a while for the server setup to complete.
#[fixture]
#[allow(dead_code)]
pub fn server<I>(#[default(&[] as &[&str])] args: I) -> TestServer
where
    I: IntoIterator + Clone,
    I::Item: AsRef<std::ffi::OsStr>,
{
    let port = port();
    let tmpdir = tmpdir();
    let child = Command::new(assert_cmd::cargo::cargo_bin!())
        .arg(tmpdir.path())
        .arg("-p")
        .arg(port.to_string())
        .args(args.clone())
        .stdout(Stdio::null())
        .spawn()
        .expect("Couldn't run test binary");
    let is_tls = args
        .into_iter()
        .any(|x| x.as_ref().to_str().unwrap().contains("tls"));

    wait_for_port(port);
    TestServer::new(port, tmpdir, child, is_tls)
}

/// Wait a max of 2s for the port to become available.
pub fn wait_for_port(port: u16) {
    let start_wait = Instant::now();

    while !port_check::is_port_reachable(format!("localhost:{port}")) {
        sleep(Duration::from_millis(250));

        if start_wait.elapsed().as_secs() > 2 {
            panic!("timeout waiting for port {port}");
        }
    }
}

#[allow(dead_code)]
pub struct TestServer {
    port: u16,
    tmpdir: TempDir,
    child: Child,
    is_tls: bool,
}

#[allow(dead_code)]
impl TestServer {
    pub fn new(port: u16, tmpdir: TempDir, child: Child, is_tls: bool) -> Self {
        Self {
            port,
            tmpdir,
            child,
            is_tls,
        }
    }

    pub fn url(&self) -> Url {
        let protocol = if self.is_tls { "https" } else { "http" };
        Url::parse(&format!("{}://localhost:{}", protocol, self.port)).unwrap()
    }

    pub fn path(&self) -> &std::path::Path {
        self.tmpdir.path()
    }

    pub fn port(&self) -> u16 {
        self.port
    }
}

impl Drop for TestServer {
    fn drop(&mut self) {
        self.child.kill().expect("Couldn't kill test server");
        self.child.wait().unwrap();
    }
}
