# Dufs Desktop 1.0.1

发布日期：2026-10-10

Dufs Desktop 1.0.1 是首个完整的 Windows、macOS 和 Linux 桌面发行版。它修复了未配置 Apple Developer 证书时 macOS 测试 DMG 无法生成的问题，并保留完整的中文桌面管理体验。

## 本次修复

- 修复 GitHub Actions 在 Apple 签名凭据为空时仍尝试导入证书的问题。
- 未配置 Apple Developer ID 时生成明确的未签名测试 DMG。
- 配置有效 Apple 凭据时继续执行正式签名和公证流程。
- 桌面应用、安装包、Git 标签和 Release 统一升级到 1.0.1。

## 主要功能

- 六步中文首次配置向导。
- 使用系统原生选择器设置共享文件夹。
- 检查目录是否存在、是否可读写以及磁盘可用空间。
- 支持仅本机访问和可信局域网访问。
- 自动检测局域网地址和端口冲突。
- 可视化设置上传、目录打包下载及文件管理权限。
- 启动、停止和重启 Dufs 服务，并执行真实 HTTP 健康检查。
- 支持系统托盘、单实例运行和用户登录时启动。
- 查看、复制和导出运行日志。
- 设置更新失败时自动恢复旧配置和旧服务。
- 保留 WebDAV、Range、断点续传、文件预览和浏览器访问能力。

## 下载说明

| 操作系统 | 下载文件 | 说明 |
|---|---|---|
| Windows 10/11 x64 | `DufsDesktop_1.0.1_windows_x64_setup.exe` | 推荐，NSIS 图形安装程序 |
| Windows 10/11 x64 | `DufsDesktop_1.0.1_windows_x64.msi` | 适合 MSI 部署需求 |
| macOS Intel | `DufsDesktop_1.0.1_macos_intel.dmg` | 适用于 Intel Mac |
| macOS Apple Silicon | `DufsDesktop_1.0.1_macos_arm64.dmg` | 适用于 Apple Silicon Mac |
| Linux x64 | `DufsDesktop_1.0.1_linux_x64.AppImage` | 通用便携格式 |
| Debian / Ubuntu x64 | `DufsDesktop_1.0.1_linux_amd64.deb` | Debian 系发行版 |
| Fedora / RHEL x64 | `DufsDesktop_1.0.1_linux_x86_64.rpm` | RPM 系发行版 |

## 安装与首次启动

Windows 用户运行推荐的 `setup.exe` 或使用 MSI。macOS 用户打开对应架构的 DMG，将应用拖入 Applications。Linux 用户可根据发行版选择 AppImage、DEB 或 RPM。

首次打开后，通过中文向导选择共享目录、访问范围、服务端口和文件权限。默认仅监听 `127.0.0.1:5000`；只有主动选择可信局域网后才监听 `0.0.0.0`。

## 数据保护

- 升级和卸载不会删除共享文件夹及其中的用户文件。
- 配置保存在操作系统的用户应用配置目录中。
- 应用只终止自己创建的 Dufs 子进程。
- 当前未启用自动更新，请从 GitHub Releases 手动升级。

## 完整性校验

Release 附带 `SHA256SUMS.txt`。Windows 可运行：

```powershell
Get-FileHash .\DufsDesktop_1.0.1_windows_x64_setup.exe -Algorithm SHA256
```

macOS 或 Linux 可运行：

```bash
sha256sum -c SHA256SUMS.txt
```

## 签名说明

- 未配置 Authenticode 的 Windows 构建可能显示“未知发布者”。
- 本次 macOS DMG 若 Release 未明确注明已签名公证，则属于未签名测试构建。
- SHA256 用于验证下载完整性，不能替代平台代码签名。

## 内核与许可证

- Dufs Desktop：`1.0.1`
- Dufs 内核：`0.46.0`
- 许可证：MIT OR Apache-2.0
