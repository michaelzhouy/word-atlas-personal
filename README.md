# 拾词 · 我的英语学习本

每天十个词，慢慢记住。基于 [Word Atlas（词光）](https://github.com/designfuchen/word-atlas) 改造的个人背词应用，先学英语，之后再扩展德语。

- 使用网址：<https://michaelzhouy.github.io/word-atlas-personal/>
- 7,298 个英语词条：插画、中文释义、例句、英美发音。
- 学习、拼写、听写、错词重练；FSRS 安排到期复习。
- 每天默认 10 个新词，可调整难度与目标。
- 手机、电脑浏览器均可使用；支持添加到手机主屏幕。
- 无需注册、后端或 AI 密钥。学习记录保存在当前浏览器，可导出、恢复备份。

## 手机使用

1. 用手机浏览器打开网址，选难度与每日目标。
2. 首页点「开始今天的旅程」；「练习」可练拼写和听写。
3. iPhone / iPad：在 Safari 点「分享」→「添加到主屏幕」。Android：在 Chrome 菜单中选「添加到主屏幕」或「安装应用」。支持直接安装的浏览器还会在「我的」提供安装按钮。
4. 在「我的」定期导出学习备份。换设备、换浏览器或清理浏览器数据前先备份，在新设备打开应用后导入。

学习记录不会自动在设备之间同步。备份包含当前词库的记录与设置，不包含词库和媒体。导入会替换当前记录，备份与词库 ID 必须对应。

首次使用请联网。安装离线入口后，可离线打开应用和已缓存的词卡、插画与音频；没有预先下载全部媒体，未缓存内容仍需联网。缓存数量有上限，浏览器也可能清理缓存。Safari 的桌面应用可能使用独立存储，必要时通过备份迁移。

## 本地开发

需要 Node.js 20+。

```sh
npm ci
npm run dev
```

默认端口 5188。开发模式不注册离线服务；验证离线行为请使用生产构建：

```sh
ATLAS_BASE=/word-atlas-personal/ npm run build
npm run preview
```

打开 <http://localhost:5188/word-atlas-personal/>。构建会生成应用入口的预缓存清单，请使用完整构建命令。

```sh
npm test
npm run check:atlas
npm run check:app
```

浏览器检查需要正在运行的生产预览和 Chrome，或已通过 `npx playwright install chromium` 安装的 Chromium。可用 `APP_URL` 指定网址、`CHROME_PATH` 指定浏览器。检查只使用隔离的测试浏览器；截图与结果在 `output/verification/`，不会提交到 GitHub。

## 部署

纯静态应用，发布目录为 `dist/`。本项目使用 GitHub Pages 的 `gh-pages` 分支。发布前先完成上述生产构建与检查，再执行：

```sh
npm run deploy:pages
```

脚本只把 `dist/` 发布到专用部署分支。需要已登录 GitHub，且仓库的 Pages 来源已设置为 `gh-pages` 根目录。其他静态托管也可以使用 `dist/`；部署到子目录时，用 `ATLAS_BASE` 设置实际路径。

## 以后加入德语

当前只有英语词库。语音回退支持 `en-GB`、`en-US`、`de-DE`；词库可以声明语言，学习进度按词库 ID 隔离。

真正加入德语时，还要准备有授权的词库与录音，处理冠词、复数、变音字母、名词大小写、例句高亮和题型判断。应使用新的德语词库 ID，保留英语进度，并验证备份不会跨词库覆盖。

## 来源与授权

基于 [designfuchen/word-atlas](https://github.com/designfuchen/word-atlas)，初始版本 `0f1bae41`。原版说明保存在 [README.upstream.md](README.upstream.md)。

- 代码、原界面与技术文档：[MIT](LICENSE)。
- 词库文本、插画与录音：**Word Atlas contributors — CC BY 4.0**，遵循 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，详见 [CONTENT_LICENSE.md](CONTENT_LICENSE.md)。
- 本分支修改了名称、图标、首次引导、默认设置、手机安装与备份说明、词卡加载失败提示、语音回退和离线缓存；词库内容沿用上游。
- 原内容由 AI 生成，经过结构检查，未逐条人工审校；不是官方雅思词表。原词库检查有 24 条例句未直接匹配词头的提示，重要用法请结合可靠词典核对。
- Fraunces 字体保留其 SIL Open Font License 1.1，其他依赖遵循各自许可证。
