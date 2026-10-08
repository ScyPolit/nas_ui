# Dufs 现代化局域网网盘开发报告

报告日期：2026-10-08（Asia/Shanghai）

## 完成状态

本次交付已形成可实际运行的 Windows 局域网网盘，不是静态演示页。Vue 前端与 Dufs Rust 后端通过真实目录 JSON、文件流、PUT/PATCH、WebDAV 方法、缩略图和存储统计接口联动；前端生产资源已嵌入 Windows 单文件程序。

## 主要改动

### Rust 后端

- 新增 `src/storage.rs`：真实磁盘容量、后台共享目录扫描、五分钟缓存、十秒手动刷新限频、统计状态、文件类型分布和最近保存。
- 扩展 `src/server.rs`：任意 Vite 资源嵌入、`/__dufs__/storage`、WebP 图片缩略图、文件变更后的统计失效标记。
- 扩展 `src/args.rs`：匿名 LAN 默认上传/搜索/目录归档，并增加 `--no-upload`、`--no-search`、`--no-archive`。
- 新增 `fs2`、`include_dir`、`image` 三个直接依赖。
- 更新 assets、权限和 WebDAV 测试；新增 `tests/storage.rs`。

### Vue 前端

- 新增完整 `web/` 工程：Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router。
- 新增现代化应用外壳、响应式侧边栏、全局搜索、中文语言资源和主题系统。
- 新增首页五大模块：真实存储空间、最近看过、最近保存、拖拽上传、目录入口。
- 新增六种资源管理器视图、目录树、面包屑、多选、排序、右键菜单、属性和权限感知操作。
- 新增统一预览：图片、PDF、音视频、文本、Markdown、JSON、代码、DOCX、XLSX。
- 新增上传任务管理：并发队列、真实进度/速度/剩余时间、取消、重试、断点恢复和同名冲突选择。
- IndexedDB 保存浏览器独立的最近看过历史。
- 按需加载 PDF、Office、ECharts 和代码高亮；主入口压缩前约 192 KB。

### 工程与文档

- 新增 Windows/Linux 一键构建和启动脚本。
- CI 增加前端安装、测试与生产构建。
- 中文 README、示例配置、第三方许可证清单和真实运行截图齐全。
- Playwright 使用本机 Edge 对真实 Rust Release 服务执行端到端验收。

## 实际测试结果

| 检查 | 结果 |
|---|---|
| `npm test` | 3 个测试文件、8 项断言全部通过 |
| `npm run build` | Vue 类型检查和 Vite 生产构建通过 |
| `npm run test:e2e` | 2 项真实 Edge 测试通过（桌面完整流程、移动端核心流程） |
| `cargo fmt --all -- --check` | 通过 |
| `cargo clippy --all --all-targets -- -D warnings` | 通过 |
| `cargo test --all --no-fail-fast` | 193 项测试全部通过 |
| `cargo build --locked --release` | Windows x64 Release 通过 |
| Release 健康检查 | `/__dufs__/health` 200，首页 200，存储接口返回真实磁盘数据 |
| `npm audit --omit=dev` | 官方 npm 审计源报告 0 个生产依赖漏洞 |

首次基线测试在未修改核心代码时因机器缺少 Rust、MSVC Build Tools，且 PATH 中第三方 `link.exe` 抢占链接器而未进入测试阶段。补齐官方 Rust 1.99.0 和 Visual Studio 2022 C++ Build Tools、显式选择 MSVC 链接器后完成了上述全量回归。

## Windows 构建产物

- 文件：`dist/dufs-modern-windows-x64.exe`
- 大小：8,724,992 字节
- SHA-256：`42B4F8D5A0941DD62D955B97478533691ED572BC50590212422989E18FAC3DC0`

验证命令：

```powershell
.\dist\dufs-modern-windows-x64.exe "D:\SharedFiles" -b 0.0.0.0 -p 5000
```

## 兼容性

以下原版能力通过现有测试回归：HTTP/HEAD、Range、多段 Range、PUT/PATCH、WebDAV、目录 ZIP、TLS、CORS、认证、隐藏路径、符号链接边界、路径前缀、自定义 assets、缓存条件和单文件分享。

有意的行为差异：默认开启匿名上传、搜索和目录归档，以符合本产品的可信局域网定位；删除、覆盖、移动和在线编辑仍默认关闭。使用 `--no-upload` 可恢复原版默认只读上传策略。

## 性能与安全说明

- 递归统计位于 `spawn_blocking` 后台任务，结果缓存，重复请求不会并发扫描。
- 扫描跳过符号链接、隐藏项和共享根目录外路径，不向接口暴露绝对路径。
- 图片缩略图限制源文件为 100 MB，并输出缓存一小时的 WebP。
- 文本预览限制为前 2 MB，Office 浏览器预览限制为 25 MB。
- Markdown 和 DOCX 派生 HTML 通过 DOMPurify 清理；SVG 不进入直接图片预览。
- 原始文件和下载保持流式传输；PDF、视频继续复用 HTTP Range。

## 尚未完整覆盖的范围

- DOCX/XLSX 是基础只读预览；不支持宏、复杂公式和桌面 Office 的完整排版保真。
- PDF/视频封面暂用类型图标，只有常见图片生成真实缩略图。
- 单目录数万项尚未使用 DOM 行虚拟化；服务器目录读取和搜索仍保持原版行为。
- 当前机器只执行了 Windows x64 构建和 Edge 验收；Linux 源码兼容路径与脚本已保留，但本次没有实际 Linux 构建证据。
- 浏览器支持的音视频格式取决于客户端编码器，不包含转码系统。

以上限制已在 README 中明确记录，未执行的目标没有标记为通过。
