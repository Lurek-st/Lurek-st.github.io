# Lurek-st.github.io

陆成洋（Lurek Lu）的个人工程作品集站点。

- 线上地址：https://lurek-st.github.io/
- 仓库：https://github.com/Lurek-st/Lurek-st.github.io
- 作者：Lurek Lu
- GitHub 用户名：Lurek-st

## 网站定位

本站已经从"泛 AI / Web3 / 数字游民个人名片"转为：

```
以工业机器人为主轴，
以研究工程和 AI 辅助工具开发为支撑的工程作品集。
```

统一设计概念：

```
From Model to Deployment
从模型到部署
```

导航固定顺序：Home / Selected Work / Focus / Skills / Journey / Contact。

## 内容维护

文案的"事实和叙事基准"是中文。英文是中文的准确翻译。Home 区文案来源**只有两处**：

1. `index.html` 的中文无 JS fallback（中文作为 `data-i18n` 属性的值或元素 fallback 文本）；
2. `assets/i18n/i18n_cn.json` 和 `assets/i18n/i18n_en.json`。

**不在 `main.js` 中保存第三套 Home 文案。**Home 打字机效果读取当前已经完成翻译的 DOM 文本（`home__focus` 与 `home__approach`），而不是硬编码任何文案。

### i18n 运行时机制

页面**不再依赖 `jquery.i18n` 插件解析 `data-i18n`**。该插件只支持 `i18n` 属性和平铺 JSON，因此语言渲染由 `assets/js/cn-en-translate.js` 中自带的 `loadLanguage(lang)` 适配器完成：

- 加载 `assets/i18n/i18n_<lang>.json`；
- 通过 `lookupKey(data, "a.b.c")` 从嵌套 JSON 取字符串；
- 渲染普通文本（`[data-i18n]`，使用 `textContent`）；
- 渲染受控 HTML 字段（`[data-i18n-html]`，例如 `contact.email_address` 含 `<br>`）；
- 渲染属性（`[data-i18n-alt]`、`[data-i18n-aria-label]`、`[data-i18n-title]`）；
- 同步 `document.documentElement.lang` 与 `localStorage.lang`；
- 更新中英文切换按钮标签；
- 语言内容落地后只触发一次 Home 动画。

语言切换由唯一的 `toggleLanguage()` 驱动，桌面菜单按钮（`#translate`）与移动端顶部按钮（`#mobile-translate`）共同调用；点击时通过 `desiredLanguage` 变量立即翻转目标语言（不依赖尚未更新的 `localStorage`），并用 `loadToken` 防止快速切换时旧响应覆盖新响应。

`jquery` 与 `jquery.i18n` 文件仍保留在仓库中，但不参与 `data-i18n` 渲染，依赖清理留给后续重构。

### 看门狗语义

5 秒 `window.__appReady` 看门狗：`main.js` 完成事件与观察器初始化后设置 `window.__mainReady`；`cn-en-translate.js` 首次语言 JSON 成功落地后设置 `window.__i18nReady`；两者都就绪后 `markAppReady()` 才设置 `window.__appReady`。若任一环节失败，看门狗移除 `js-enabled`，中文 HTML fallback 保持可读。

修改首屏文案时，需要同步：
- `index.html` 中对应元素的 `data-i18n` fallback 文本；
- `assets/i18n/i18n_cn.json`；
- `assets/i18n/i18n_en.json`（作为中文的准确翻译）。

修改项目标题、描述或工作项时，同步三处：`index.html`、`i18n_cn.json`、`i18n_en.json`。

## 项目状态边界

下列事实已冻结，**不得改写**：

- 机器人标定项目状态为 `Software Frozen / Field Validation Pending`。
  - 不得描述为"已完成现场标定"、"已完成工业部署"、"已获得控制器认证参数"、"已上线生产线"、"已完成真实机器人验证"。
- 天气—市场研究系统不得描述为"股票预测系统"、"天气预测股票"、"已证明天气影响股市"、"自动交易"、"投资策略"、"可用于获利"。
- PaperForge 不得描述为"自动保证论文分析正确"、"自动替代研究者"、"自动读完全部论文"、"无需人工证据判断"。

## 图片来源

- `assets/img/cat.png`：现有猫形象，作为 Home 视觉基础。
- **Home 工程叠加层**（网格、XYZ 坐标轴、两组点云、轨迹弧线、`MODEL → VALIDATE → DEPLOY` 文字）：以**内联 SVG** 形式存在于 `index.html` 的 `.home__hero-overlay` 中（可被页面 CSS 的 `currentColor` 控制并做点云收敛、轨迹绘制动画）。
- **项目流程 SVG**（PaperForge / Weather–Market / Codex 交付流程 / About 流程线）：同样以**内联 SVG** 形式存在于各项目卡的 `.project__visual` 中，由 `IntersectionObserver` 触发节点依次点亮动画。
- `assets/img/projects/robot-calibration-cover.webp` 与 `...-metrics.webp`：项目视觉面板（明确为封面设计，**不是**实验截图），使用冻结指标、技术标签和状态标签。
- `assets/img/projects/paperforge-workspace.webp`：使用 PaperForge 公开工作流目录结构（inbox/processing/cache/failed/archive/logs）。
- `assets/img/projects/weather-market-status.webp`：状态面板（VALIDATED/PARTIAL/REJECTED/TRACEABLE）示意。
- `assets/img/projects/codex-naiwa-cover.webp`：封面使用从公开 Codex Naiwa 精灵图（`https://raw.githubusercontent.com/Lurek-st/codex-pet-naiwa-enhanced/main/naifrog/spritesheet.webp`）提取的真实帧；工作流为交付流程示意。
- `assets/img/og-cover.webp`：OG 1200×630，紫色深色主题，包含猫形象、抽象坐标轴、点云与三行关键字。
- 不使用远程热链接；不下载与项目无关的库存图。

## Skills

技能百分比表示当前项目应用能力，**不是**考试成绩或正式认证。修改百分比时同步：

- `index.html` 中 `data-level` 与 `aria-valuenow`；
- 进度条 `style="--level:X%"`。

## 本地开发

```bash
# 1. 联网（Unicons CDN）
# 2. 启动任意静态服务器，例如：
python -m http.server 8765
# 3. 浏览器访问 http://localhost:8765/
```

## 注意事项

- 首页默认中文 fallback。语言切换由 `assets/js/cn-en-translate.js` 的 `loadLanguage()` 驱动，并同步 `<html lang>`。
- Home 动画带并发防护：`refreshHome()` 每次递增 generation token（`homeAnimationRun`），被取消的旧 run **不会**把旧语言文字写回 DOM（只静默退出并移除光标 class），新 run 从 loader 已写入的完整目标语言文本开始逐字输入。`isHomeAnimating()` 使用真实的进行中计数。
- Home 分层入场：`home__eyebrow/title/subtitle/actions/tags` 五个静态层在 `.js-enabled` 下按 `--layer-index` 阶梯淡入（`home--entered` 触发）；`home__focus/home__approach` 由打字机呈现，不作为 CSS 层。
- 动画默认通过 `IntersectionObserver` 触发一次：点云**收敛**动画（`cloud-b` 按各 SVG 内联的 `--align-x/--align-y` 向另一组点云靠近，非完全重合）、轨迹绘制、流程节点点亮（每个逻辑节点是一个带 `--flow-index` 的 `.flow-node` 分组，矩形与文字在同一分组内，按索引递增延迟）、技能进度条、About/项目卡 reveal。`prefers-reduced-motion: reduce` 时全部直接显示最终状态。
- `window.__appReady` 在 `__mainReady` 与 `__i18nReady` 均就绪后才设置（见上文看门狗语义）。
- 不删除仓库中保留的 Swiper 等第三方文件（依赖文件清理留给后续重构）。
- `archive/legacy-profile` 分支保留，**不得**修改或删除。
