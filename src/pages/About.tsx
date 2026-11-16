import { ArrowUpRight, Database, Github, Heart } from "lucide-react";
import { useAtlas } from "../atlas/context";
import { REPO_URL, UPSTREAM_URL } from "../config";

const BASE = import.meta.env.BASE_URL;

export function About() {
  const atlas = useAtlas();
  return (
    <div className="page about">
      <header className="about-hero">
        <img src={`${BASE}brand/og.webp`} alt="" />
        <div>
          <p className="eyebrow">关于拾词</p>
          <h1 className="display">每天一点，慢慢记住。</h1>
          <p className="lede">
            拾词是基于开源 Word Atlas 改造的个人英语学习本。现有{" "}
            {atlas.count.toLocaleString()}{" "}
            个英语词条，配插画、例句和英美发音。从每天 10
            个词开始，学新词、练拼写，按记忆情况复习。
          </p>
          <p className="lede">
            无需注册，也不需要 AI
            密钥。学习记录保存在你的浏览器里，可以导出备份。可添加到手机主屏幕，已缓存的内容可离线使用。
          </p>
          <div className="about-actions">
            <a
              className="btn btn-primary"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              <Github size={18} /> 在 GitHub 上查看
            </a>
            <a
              className="btn btn-ghost"
              href={`${REPO_URL}/tree/main/data`}
              target="_blank"
              rel="noreferrer"
            >
              <Database size={18} /> 下载词库 JSON / CSV
            </a>
          </div>
        </div>
      </header>

      <div className="about-grid">
        <section className="panel">
          <h3 className="eyebrow">开源与署名</h3>
          <p className="muted">
            基于{" "}
            <a href={UPSTREAM_URL} target="_blank" rel="noreferrer">
              Word Atlas（词光）
            </a>
            。代码、界面与文档使用{" "}
            <a
              href={`${REPO_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
            >
              MIT 许可证
            </a>
            ；词库文本、插画与录音署名为{" "}
            <b>Word Atlas contributors — CC BY 4.0</b>，遵循{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
            。
          </p>
          <p className="muted">
            本分支增加了个人词本、粘贴单词匹配、熟词跳过与恢复、精简词卡，并修改了应用名称、首次引导、默认设置、手机安装说明、备份与离线缓存。英语词库内容沿用原项目，德语词库尚未加入。
          </p>
        </section>
        <section className="panel">
          <h3 className="eyebrow">为什么记得住</h3>
          <ul className="feature-list">
            <li>
              <b>先看见。</b>每个词都有一幅画，画的就是第一句例句里发生的事。
            </li>
            <li>
              <b>再想起。</b>选义、看图补句、听音辨词、拼写，从认得走到会写。
            </li>
            <li>
              <b>刚好在快忘时重逢。</b>FSRS 是新版 Anki
              用的开源记忆算法，只在你快要遗忘时安排复习。
            </li>
            <li>
              <b>分数诚实。</b>
              只算第一次作答。答错的词会换个题型再见一面，但不会抬高正确率。
            </li>
            <li>
              <b>进度只属于你。</b>
              没有账号，没有服务器，数据存在你的浏览器里，随时能导出。
            </li>
          </ul>
        </section>

        <section className="panel">
          <h3 className="eyebrow">快捷键</h3>
          <dl className="keys">
            <div>
              <dt>
                <kbd>⌘</kbd>
                <kbd>K</kbd> 或 <kbd>/</kbd>
              </dt>
              <dd>搜索任何词</dd>
            </div>
            <div>
              <dt>
                <kbd>1</kbd>–<kbd>4</kbd>
              </dt>
              <dd>选择答案</dd>
            </div>
            <div>
              <dt>
                <kbd>Enter</kbd>
              </dt>
              <dd>确认 / 继续</dd>
            </div>
            <div>
              <dt>
                <kbd>←</kbd> <kbd>→</kbd>
              </dt>
              <dd>词卡里切换上一个、下一个</dd>
            </div>
            <div>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>关闭弹窗</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h3 className="eyebrow">内容从哪里来</h3>
          <p className="muted">
            释义、例句、搭配和提示由大语言模型按统一的词典规范重新撰写；插画由图像模型按统一画风逐词绘制；发音和朗读由
            ElevenLabs 合成（英音 Alice，美音
            Sarah）。所有内容都经过结构和一致性的自动校验，但没有逐条人工审校。看到错的地方，欢迎在
            GitHub 提 Issue，或者直接改数据提 PR。
          </p>
          <p className="muted">
            本应用不是官方雅思词表。释义、例句和插画没有逐条人工审校，请结合可靠词典核对重要用法。
          </p>
        </section>

        <section className="panel">
          <h3 className="eyebrow">给开发者</h3>
          <p className="muted">
            <code>data/word-atlas.json</code> 和 <code>.csv</code> 是完整词库；
            <code>public/atlas</code> 里是网页用的分块数据、插画和音频。拿去做
            Anki 牌组、背词小程序、浏览器插件，或者 AI 应用的评测集，署名即可。
          </p>
          <a
            className="link"
            href={`${REPO_URL}#readme`}
            target="_blank"
            rel="noreferrer"
          >
            阅读文档 <ArrowUpRight size={14} />
          </a>
        </section>
      </div>
      <p className="colophon">
        <Heart size={14} /> 做给每一个在背单词的人。
      </p>
    </div>
  );
}
