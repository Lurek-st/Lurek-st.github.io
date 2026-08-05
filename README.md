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
- 首屏打字机文案（home__title / home__subtitle / home__description）还存在于 assets/js/main.js 的 typingTexts 中。
- 修改首屏文案时，需要同步更新：i18n_cn.json、i18n_en.json、index.html fallback、main.js typingTexts，避免多数据源不一致。
```
