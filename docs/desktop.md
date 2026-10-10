# Dufs 跨平台桌面版

Dufs 桌面版是现有文件服务器的图形管理外壳。它使用 Tauri 2 启动安装包内与当前平台架构一致的 Dufs Sidecar，不改变 Dufs 的 HTTP、WebDAV 或文件 URL。用户不需要安装 Rust、Node.js，也不需要使用命令行。

## 安装

### Windows 10/11 x64

- 普通用户优先下载 `DufsDesktop_<版本>_windows_x64_setup.exe`，按 NSIS 安装向导完成安装。
- 需要 MSI 部署时下载 `DufsDesktop_<版本>_windows_x64.msi`。
- 未使用 Authenticode 签名的测试构建可能显示“未知发布者”。只有确认来源及 SHA256 后再运行。

### macOS

- Intel Mac 下载 `DufsDesktop_<版本>_macos_intel.dmg`。
- Apple Silicon 下载 `DufsDesktop_<版本>_macos_arm64.dmg`。
- 打开 DMG，将应用拖入 Applications，再从应用程序中启动。

仅当 Release 说明明确注明已签名和公证时，才代表该 DMG 已通过 Apple 官方公证。未配置 Apple 凭据的 CI 产物是测试构建。

### Linux x64

- AppImage：通用便携包，赋予执行权限后运行；它不会像系统包一样自动安装。
- DEB：适用于 Debian、Ubuntu 及兼容系统。
- RPM：适用于 Fedora、RHEL 及兼容系统。

Linux 桌面运行依赖 WebKitGTK 4.1。DEB/RPM 会声明相应依赖；不同桌面环境的托盘实现可能存在差异。

## 首次配置

首次运行会进入六步中文向导：

1. 选择一个已经存在且当前用户可读取的共享文件夹。支持中文、空格及平台原生路径。
2. 选择“仅本机”或“可信局域网”，并设置 1 到 65535 的空闲端口。
3. 设置上传、目录归档和管理权限。Dufs 的删除、覆盖与移动共用 `allow-delete` 能力，因此桌面版将它们合并为一个管理开关。
4. 选择登录启动、自动启动服务、托盘后台运行和完成后打开网页。
5. 检查摘要并完成配置。
6. 程序保存配置、启动 Sidecar，并等待真实的 `GET /__dufs__/health` 返回成功。

局域网模式监听 `0.0.0.0`，界面会显示实际网卡地址。它不会把 `0.0.0.0` 当作访问 URL。请只在可信家庭或办公网络中启用；Windows 防火墙提示必须由用户主动确认。

## 服务管理

管理主页可启动、停止和重启服务，打开浏览器中的网盘、打开共享目录并复制局域网地址。状态同时来自受管理子进程和 HTTP 健康检查。桌面应用只终止自己创建并持有句柄的进程，不会按名称结束用户从命令行启动的其他 Dufs 实例。

关闭窗口且启用后台运行时，服务继续由托盘管理。托盘“退出程序”会停止本应用管理的服务。单实例插件会把第二次启动转交给已有窗口。

## 配置、日志与数据保护

配置使用 Tauri 的系统应用配置目录，文件名为 `settings.json`；日志使用系统应用日志目录。配置通过同目录临时文件、同步和原子替换写入。损坏或版本不兼容的配置会被备份，然后重新进入向导。

日志单文件上限 2 MiB，轮转为 `.log.1`，界面最多显示最近 1000 行。配置与日志不存放在安装目录或共享目录中。

卸载、升级和重装都不会删除用户选择的共享文件夹及其中的文件。配置默认保留，以便重装后恢复。登录启动由当前用户级自动启动机制管理，不安装需要管理员权限的系统服务。

## 本地开发

需要 Node.js 22+、Rust stable、Tauri 2 对应的平台工具链。Windows 还需要 Visual Studio C++ Build Tools 和 Windows SDK。

```powershell
cd web
npm ci
npm test
npm run build

cd ..
cargo build --locked --release --target x86_64-pc-windows-msvc

cd desktop
npm ci
$env:TAURI_TARGET = "x86_64-pc-windows-msvc"
npm run check:version
npm run prepare:sidecar
npm run tauri:dev -- --target $env:TAURI_TARGET
```

安装包构建：

```powershell
npm run tauri:build -- --target x86_64-pc-windows-msvc --bundles nsis,msi
```

Sidecar 必须位于 `desktop/src-tauri/binaries/dufs-<target-triple>[.exe]`。`prepare-sidecar.mjs` 会检查 PE、Mach-O 或 ELF 格式及可识别的目标架构后再复制。

## GitHub Releases

桌面产品版本同时保存在以下三个文件中：

- `desktop/package.json`
- `desktop/src-tauri/Cargo.toml`
- `desktop/src-tauri/tauri.conf.json`

发布标签格式为 `desktop-vX.Y.Z`。Dufs 内核保留自身版本（当前为 0.46.0），两者互不混淆。

1. 更新三个桌面版本并运行 `npm run check:version`。
2. 合并并确认 CI 成功。
3. 在确认的提交上创建并推送 `desktop-vX.Y.Z` 标签。
4. `desktop-release.yaml` 在四种原生 Runner 上构建七个安装包。
5. 聚合任务校验每类产物恰好一个且非空，统一命名，生成排序后的 `SHA256SUMS.txt`。
6. 工作流创建 Draft Release，由维护者检查后手动发布。

手动触发必须输入已经存在的标签；工作流不会创建或推送标签，也始终构建该标签解析出的不可变提交。

### 签名凭据

仓库不得保存证书或私钥。macOS 正式签名和公证使用 GitHub Secrets：

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

Windows Authenticode 证书需要在受保护的发布环境接入后再启用。当前没有 Tauri Updater 私钥，因此未启用自动更新，也没有绕过更新签名校验。用户可以通过 GitHub Releases 手动升级，配置和共享数据会保留。

## 故障排除

- **端口不可用**：换用其他端口，或停止占用该端口的程序。
- **文件夹无法读取**：选择当前用户有权限访问的目录；应用不会静默修改系统权限。
- **其他设备无法访问**：确认选择了可信局域网、设备在同一网络，并检查系统防火墙。
- **服务健康检查失败**：打开“运行日志”查看启动摘要，确认共享目录仍存在。
- **macOS 阻止测试构建**：确认 Release 是否注明已签名公证；不要把未经公证的测试包视为正式发行版。

## 验证范围

Windows 可以在当前开发机完成源码、Sidecar、桌面程序及安装包的真实构建验证。macOS Intel、macOS Apple Silicon 和 Linux x64 必须由工作流的原生 Runner 构建；在对应系统完成安装、托盘、开机启动和卸载测试前，应标记为“已配置构建流程，尚未完成人工实机验收”。
