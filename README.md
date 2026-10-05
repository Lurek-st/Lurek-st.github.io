# Lurek-st.github.io

#### 介绍
- 响应式个人简介网页 ✨
- 个人网页URL ：https://lurek-st.github.io/

#### 运行

```
- 【联网！联网！联网！】（网页图标使用的资源库：https://iconscout.com/unicons/free-line-icon-fonts）
- vscode 安装扩展 live server
- 打开 index.html
- 右击-选择"open with live server"
- vscode 将自动跳转至 http://localhost:5500/index.html

```

#### 注意
```
- i18n 中英文文本配置在 assets/i18n/ 目录的json文件内（i18n_cn.json / i18n_en.json）。
- 页面正常运行时以 JSON 中的文本为准，i18n 会替换页面中的文案。
- index.html 中的默认文本是中文 fallback：当 i18n 或 JavaScript 加载失败时展示，需与 i18n_cn.json 保持一致。
- 首屏打字机文案（home__title / home__subtitle / home__description / home__life）还存在于 assets/js/main.js 的 typingTexts 中。
- 修改首屏文案时，需要同步更新：i18n_cn.json、i18n_en.json、index.html fallback、main.js typingTexts，避免多数据源不一致。
```

#### 新版首页与发布

- 正式入口为根目录 `index.html`，GitHub Pages 从 `main` 分支根目录发布，无须额外构建。
- `stage.css`、`stage.js`、`stage-details.js` 和 `stage-background.css/js` 分别负责新版排版、项目展台、技能与联系区、全局曲线。它们是正式首页所需资源，名称沿用已验收设计中的组件标识。
- Fraunces 字体及许可位于 `assets/fonts/stage-fraunces/`；奶蛙项目使用 `assets/img/stage-naiwa-user-20261004.png`。
- 首页已直接使用正式双语 JSON 与 `typingTexts`，不再依赖本地预览的文案覆盖脚本。更新这些资源时，同时更新 `index.html` 中的版本查询参数，以及 `cn-en-translate.js` 的 JSON 版本参数，避免浏览器继续使用旧文案。
- 运行 `npm run test:browser` 验证新版。可通过 `TEST_BASE_URL` 检查已启动的预览或正式站，通过 `TEST_ARTIFACTS_DIR` 指定检查输出目录，通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 使用已安装的浏览器。
- `npm run test:browser:legacy` 保留旧版布局测试用于历史对照，其中旧轮播和旧标题断言不适用于新版。
