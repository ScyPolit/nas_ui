# Dufs Desktop 1.0.0

发布日期：2026-10-10

Dufs Desktop 的首个跨平台桌面版本现已发布。它将 Dufs 0.46.0 文件服务内核、现代化 Web 网盘和中文桌面管理程序整合为原生安装包，普通用户无需安装 Rust、Node.js，也不需要使用命令行。

## 主要功能

- 六步中文首次配置向导。
- 使用系统原生选择器设置共享文件夹。
- 检查目录是否存在、是否可读写以及磁盘可用空间。
- 支持仅本机访问和可信局域网访问。
- 自动检测可用局域网地址和端口冲突。
- 可视化设置上传、目录打包下载及文件管理权限。
- 启动、停止和重启 Dufs 服务，并执行真实 HTTP 健康检查。
- 支持系统托盘、单实例运行和用户登录时启动。
- 查看、复制和导出运行日志。
- 设置更新失败时自动恢复旧配置和旧服务。
- 保留原有 WebDAV、Range、断点续传、文件预览和浏览器访问能力。

## 下载说明

| 操作系统 | 下载文件 | 说明 |
|---|---|---|
| Windows 10/11 x64 | `DufsDesktop_1.0.0_windows_x64_setup.exe` | 推荐，标准 NSIS 图形安装程序 |
| Windows 10/11 x64 | `DufsDesktop_1.0.0_windows_x64.msi` | 适合 MSI 部署需求 |
| macOS Intel | `DufsDesktop_1.0.0_macos_intel.dmg` | 适用于 Intel Mac |
| macOS Apple Silicon | `DufsDesktop_1.0.0_macos_arm64.dmg` | 适用于 M1、M2、M3、M4 等 Apple Silicon Mac |
| Linux x64 | `DufsDesktop_1.0.0_linux_x64.AppImage` | 通用便携格式，不会自动完成系统级安装 |
| Debian / Ubuntu x64 | `DufsDesktop_1.0.0_linux_amd64.deb` | Debian 系发行版安装包 |
| Fedora / RHEL x64 | `DufsDesktop_1.0.0_linux_x86_64.rpm` | RPM 系发行版安装包 |

请根据设备的操作系统和处理器架构选择文件，不要在不同平台之间混用安装包。

## 安装与首次启动

### Windows

运行推荐的 `setup.exe` 并按照安装向导操作，也可以使用 MSI。首次打开 Dufs 网盘后，在中文向导中选择共享目录、访问范围、端口和文件权限。

### macOS

打开对应架构的 DMG，将 Dufs 网盘拖入 Applications，然后启动应用并完成首次配置。

### Linux

根据发行版安装 DEB 或 RPM。使用 AppImage 时，需要先赋予文件执行权限，再从文件管理器或桌面环境中启动。

## 默认安全设置

- 默认仅监听 `127.0.0.1:5000`，只允许本机访问。
- 默认允许浏览、下载、上传和目录打包下载。
- 默认禁止删除、覆盖和移动文件。
- 只有用户主动选择“可信局域网”后才监听 `0.0.0.0`。
- 桌面管理命令只对本机 Tauri 窗口开放，不通过 Dufs HTTP 页面暴露。
- 应用只管理自己启动的 Dufs 子进程，不会按进程名终止其他 Dufs 实例。

局域网模式仅适合可信家庭或办公网络。请勿使用默认匿名配置直接暴露到互联网。

## 数据与升级

- 升级和卸载不会删除用户选择的共享文件夹及其中的文件。
- 配置保存在操作系统的用户应用配置目录中，不写入安装目录或共享目录。
- 重新安装后会尽可能恢复已有配置。
- 当前版本未启用自动更新，请从 GitHub Releases 手动下载并安装新版本。

## 完整性校验

Release 同时提供 `SHA256SUMS.txt`。下载后可以校验安装包是否完整。

Windows PowerShell：

```powershell
Get-FileHash .\DufsDesktop_1.0.0_windows_x64_setup.exe -Algorithm SHA256
```

macOS 或 Linux：

```bash
sha256sum -c SHA256SUMS.txt
```

## 签名说明

- 未配置 Authenticode 的 Windows 构建可能显示“未知发布者”。
- 只有 Release 明确注明已签名和公证时，macOS DMG 才代表已经通过 Apple 官方公证。
- 校验文件只能验证下载内容是否与本次 Release 一致，不能代替平台代码签名。

## 验证状态

Windows x64 版本已完成实际 Release 构建、Sidecar 架构检查、安装包内容检查以及桌面程序启动和中文界面验证。

macOS Intel、macOS Apple Silicon 和 Linux x64 安装包由对应的 GitHub 原生 Runner 构建。在完成各目标系统的人工安装、托盘、开机启动和卸载验收前，这些产物应视为首发测试范围。

## 已知限制

- 浏览器只能播放自身支持编码的音视频文件，当前不包含转码服务。
- DOCX 和 XLSX 为基础只读预览，不保证完整还原复杂排版、公式、宏和嵌入对象。
- 不同 Linux 桌面环境对系统托盘的支持可能存在差异。
- Windows 和 macOS 正式公开分发仍建议配置平台代码签名。

## 内核与许可证

- Dufs Desktop：`1.0.0`
- Dufs 内核：`0.46.0`
- 许可证：MIT OR Apache-2.0

感谢试用 Dufs Desktop。遇到问题时，请在仓库提交 Issue，并附上操作系统版本、安装包名称和桌面程序导出的日志。
