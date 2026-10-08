# 第三方开源组件

本项目继续采用 Dufs 的 MIT 或 Apache-2.0 双许可证。下表记录现代化重构直接引入的主要依赖；完整传递依赖及精确版本以 `Cargo.lock` 和 `web/package-lock.json` 为准。

| 组件 | 用途 | 许可证 |
|---|---|---|
| Vue 3 | 前端组件框架 | MIT |
| TypeScript | 类型系统 | Apache-2.0 |
| Vite | 前端构建 | MIT |
| Element Plus | 基础 UI 组件 | MIT |
| Pinia | 前端状态管理 | MIT |
| Vue Router | Hash 路由 | MIT |
| Lucide (`@lucide/vue`) | 界面图标 | ISC；部分源自 Feather 的图标为 MIT |
| Apache ECharts | 存储容量图表 | Apache-2.0 |
| PDF.js (`pdfjs-dist`) | PDF 浏览 | Apache-2.0 |
| marked | Markdown 解析 | MIT |
| DOMPurify | 不可信 HTML 清理 | MPL-2.0 或 Apache-2.0 |
| highlight.js | 代码高亮 | BSD-3-Clause |
| docx-preview | DOCX 基础只读预览 | Apache-2.0 |
| read-excel-file | XLSX 基础只读预览 | MIT |
| Playwright | 浏览器端到端验收 | Apache-2.0 |
| fs2 | 跨平台文件系统容量查询 | MIT 或 Apache-2.0 |
| include_dir | 将前端产物嵌入 Rust 二进制 | MIT |
| image-rs | 生成图片缩略图 | MIT 或 Apache-2.0 |

没有从 `dufs-tabler-web` 或 `dufs_web` 复制源代码。本项目仅参考文件管理器类产品的通用交互模式，避免拼接不同项目的 UI 实现。

构建产物不得删除依赖包要求保留的版权与许可证声明。发布前可结合 `cargo-about` 和 `license-checker` 对锁定版本再次生成机器可读清单。
