# Dufs Desktop 1.0.0 开发与验证报告

报告日期：2026-10-10（Asia/Shanghai）

## 技术方案

桌面版采用 Tauri 2、Vue 3、TypeScript、Element Plus 和 Lucide。现有 Dufs 0.46.0 作为按目标架构构建的 Sidecar 随安装包分发。选择 Sidecar 而不是把服务器改造成库，是为了保留现有 CLI、HTTP/WebDAV 行为和测试覆盖，减少对文件服务核心的侵入，并隔离桌面外壳与服务进程故障。

桌面程序只保存并终止自己创建的子进程句柄，不按进程名查杀。服务启动成功以实际 `GET /__dufs__/health` 为准。配置写入系统应用配置目录，使用临时文件、同步和原子替换；日志写入系统日志目录并按 2 MiB 轮转。

## 已实现

- 六步中文首次配置向导：欢迎、目录、网络、权限、系统选项、确认。
- 原生目录选择、目录存在/读写/可用空间检查、端口占用检查。
- 仅本机与可信局域网模式，展示实际 IPv4 局域网地址。
- Dufs 后端执行上传、归档和删除/覆盖/移动权限。
- 启动、停止、重启、意外退出检测、真实健康检查和运行时长。
- 单实例、系统托盘、关闭后台运行、用户级登录启动。
- 配置修改时停止旧服务；新配置失败则恢复旧配置和旧服务。
- 日志查看、复制、导出和打开日志位置。
- Windows NSIS/MSI、macOS Intel/ARM64 DMG、Linux AppImage/DEB/RPM 构建矩阵。
- Sidecar PE/Mach-O/ELF 格式与架构检查、桌面版本一致性检查。
- 标签绑定的 GitHub Actions、七产物完整性验证、SHA256 和 Draft Release。

## 实际测试

| 检查 | 结果 |
|---|---|
| 原项目 `cargo test --all --no-fail-fast` | 193 项通过 |
| Web `npm test` | 4 个文件、15 项通过 |
| Web `npm run build` | 通过 |
| Desktop `npm test` | 1 个文件、2 项通过 |
| Desktop `npm run build` | TypeScript 与 Vite 构建通过 |
| Desktop `cargo check --locked` | 通过 |
| Desktop `cargo clippy --locked --all-targets -- -D warnings` | 通过 |
| Desktop `cargo test --locked` | 通过 |
| 桌面依赖 `npm audit --omit=dev` | npm 官方源报告 0 个漏洞 |
| Actions YAML | `yaml-lint` 通过 |
| Windows Dufs Sidecar | x64 Release 构建通过，PE 架构检查通过 |
| Windows 桌面程序 | x64 Release 构建并真实启动，窗口有响应 |
| Windows UI | 截图确认中文首次向导正常渲染，不是空白页 |
| Windows NSIS | 实际生成，打包清单确认包含 `dufs.exe` |
| Windows MSI | 实际生成，WiX 组件确认包含 `dufs.exe` |
| 版本检查 | package、Cargo、Tauri 配置均为 1.0.0 |

## 本地安装包

目录：`artifacts/desktop/1.0.0/`

- `DufsDesktop_1.0.0_windows_x64_setup.exe`：6,029,643 字节
- `DufsDesktop_1.0.0_windows_x64.msi`：8,171,520 字节
- `SHA256SUMS.txt`

当前安装包没有 Authenticode 签名，Windows 可能显示未知发布者。仓库中没有证书或私钥。

## 尚未验证

- 当前机器不是 macOS 或 Linux，因此 Intel/Apple Silicon DMG、AppImage、DEB 和 RPM 只完成了原生 Runner 构建配置，尚未在对应系统实际生成和人工安装。
- 尚未执行 Windows 安装器的交互式安装、卸载、重启系统、登录自动启动和防火墙确认测试；已验证安装包生成及内容清单。
- 未配置 Apple Developer ID，不能声称 DMG 已签名或公证。
- 未配置 Windows Authenticode 证书。
- 自动更新需要独立的签名密钥和不可变下载地址，本次未启用，也未禁用签名校验来规避要求。

## 正式发布

确认版本后，在目标提交上创建并推送 `desktop-v1.0.0` 标签。`.github/workflows/desktop-release.yaml` 会解析该标签对应的不可变提交，在四种原生 Runner 上构建，要求七个安装包全部存在，生成 `SHA256SUMS.txt`，然后创建 Draft Release。工作流不会创建或推送标签，也不会自动公开 Release。
