# Dufs Desktop 1.0.2

发布日期：2026-10-11

Dufs Desktop 1.0.2 是启动性能与可靠性修复版本，建议所有桌面版用户升级。

## 本次修复

- 修复应用启动后长期停留在“正在读取本机配置”的问题。
- 修复对 Vue 响应式配置调用 `structuredClone` 导致 `DataCloneError` 的问题。
- 即使读取配置或系统状态失败，桌面界面也会在超时后进入可操作状态，不再永久阻塞。
- 配置读取完成后立即显示界面，服务健康状态改为后台刷新。
- 服务停止时不再枚举系统网卡。
- TCP 健康检查和网卡枚举移至阻塞线程池，不再占用 Tauri 命令处理线程。
- 健康检查超时从 500 毫秒缩短为 250 毫秒。
- 状态刷新增加防重入控制，周期从 3 秒调整为 5 秒。
- 优化安装了 Hyper-V、VMware、VirtualBox、VPN 等大量虚拟网卡设备上的启动速度。

## 实际验证

- Windows x64 冷启动窗口约 810 毫秒出现。
- 首屏直接进入中文配置向导，不再显示无限加载状态。
- 使用真实 Vue `reactive` Proxy 完成配置复制回归测试。
- Desktop 前端 3 项测试通过。
- TypeScript、Vite、Rust check、Clippy 全部通过。

## 下载说明

| 操作系统 | 下载文件 |
|---|---|
| Windows 10/11 x64 | `DufsDesktop_1.0.2_windows_x64_setup.exe`（推荐） |
| Windows 10/11 x64 | `DufsDesktop_1.0.2_windows_x64.msi` |
| macOS Intel | `DufsDesktop_1.0.2_macos_intel.dmg` |
| macOS Apple Silicon | `DufsDesktop_1.0.2_macos_arm64.dmg` |
| Linux x64 | `DufsDesktop_1.0.2_linux_x64.AppImage` |
| Debian / Ubuntu x64 | `DufsDesktop_1.0.2_linux_amd64.deb` |
| Fedora / RHEL x64 | `DufsDesktop_1.0.2_linux_x86_64.rpm` |

## 数据与升级

- 可以直接覆盖安装1.0.1。
- 升级不会删除共享目录或用户文件。
- 已有配置会继续保留。
- 当前未启用自动更新，请手动下载安装新版本。

## 签名说明

- 未配置 Authenticode 的 Windows 构建可能显示“未知发布者”。
- macOS DMG 若未明确注明已签名公证，则属于未签名测试构建。
- 请使用随Release提供的 `SHA256SUMS.txt` 校验文件完整性。

## 内核与许可证

- Dufs Desktop：`1.0.2`
- Dufs 内核：`0.46.0`
- 许可证：MIT OR Apache-2.0
