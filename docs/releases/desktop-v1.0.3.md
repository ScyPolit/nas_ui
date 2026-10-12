# Dufs Desktop 1.0.3

发布日期：2026-10-12

Dufs Desktop 1.0.3 新增 Windows 免安装版本，并修复 Windows 启动时显示终端窗口的问题。

## 新增与改进

- 新增 Windows x64 portable 压缩包，解压后双击 `DufsDesktopPortable.exe` 即可使用。
- Portable 配置和日志保存在程序旁的 `data` 目录，复制整个目录即可迁移。
- 修复 NSIS、MSI 和 portable 版本启动桌面程序时同时显示终端窗口的问题。
- Dufs sidecar 继续支持独立命令行使用；由桌面程序启动时通过 `CREATE_NO_WINDOW` 静默运行。
- CI 和发布流程增加 Windows PE 子系统检查，避免终端窗口问题回归。
- 发布流程自动构建、校验并上传 portable 压缩包。

## Windows 下载

| 类型 | 文件 |
|---|---|
| Portable 免安装版 | `DufsDesktop_1.0.3_windows_x64_portable.zip` |
| NSIS 安装包 | `DufsDesktop_1.0.3_windows_x64_setup.exe` |
| MSI 安装包 | `DufsDesktop_1.0.3_windows_x64.msi` |

Windows 10/11 x64 需要 Microsoft Edge WebView2 Runtime。未配置 Authenticode 的构建可能显示未知发布者，请使用 Release 中的 `SHA256SUMS.txt` 校验文件完整性。

## 兼容性

- 安装版继续使用系统用户配置目录，可以直接从 1.0.2 覆盖升级。
- Portable 版不读取或覆盖安装版配置。
- 用户选择的共享目录及其中的文件不会被升级或卸载操作删除。
