import {
  ArrowRight,
  BookMarked,
  Check,
  ChevronLeft,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAtlas } from "../atlas/context";
import type { Atlas } from "../atlas/types";
import { go, openWord, type Route } from "../lib/router";
import {
  activeNotebook,
  addWords,
  makeNotebook,
  matchWords,
  removeNotebook,
  setFamiliar,
} from "../store/notebooks";
import { isMastered } from "../store/srs";
import { store, useStore, type Notebook } from "../store/store";
import { toast } from "../ui/Toast";

export function Notebooks({
  route,
}: {
  route: Extract<Route, { page: "notebooks" }>;
}) {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const [creating, setCreating] = useState(false);
  const current = progress.notebooks.find((b) => b.id === route.book);
  const selected = activeNotebook(progress);
  const pending = route.add ? atlas.byId.get(route.add) : undefined;
  const select = (id: string | null) => {
    store.progress((p) => ({ ...p, activeNotebookId: id }));
    toast(
      progress.session && !progress.session.finished
        ? "已选择，本轮完成后生效"
        : "已更新今日新词来源",
      "ok",
    );
  };
  const addPending = (book: Notebook) => {
    if (!pending) return;
    store.progress((p) => addWords(p, book.id, [pending.id]));
    toast(`已将 ${pending.word} 收进「${book.name}」`, "ok");
    go({ page: "notebooks", book: book.id });
  };
  return (
    <div className="page notebooks">
      <header className="notebooks-head">
        <div>
          <p className="eyebrow">我的词本 · MY WORDBOOKS</p>
          <h1 className="display">
            遇见的词，
            <br />
            收进自己的书。
          </h1>
          <p className="lede">
            一篇文章、一门课、一次旅行。把想记住的词，放在一起。
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setCreating(true)}
          disabled={progress.notebooks.length >= 100}
        >
          <Plus size={18} /> 新建词本
        </button>
      </header>
      {pending && (
        <div className="notebook-pending" role="status">
          <p>
            把 <b lang="en">{pending.word}</b> 收进哪个词本？也可以新建一本。
          </p>
          <button
            className="link"
            onClick={() => go({ page: "notebooks", book: route.book })}
          >
            取消添加
          </button>
        </div>
      )}
      <div className="notebook-source">
        <BookMarked size={20} />
        <div>
          <b>今日新词来源：{selected?.name ?? "完整图鉴"}</b>
          <p>新词从这里选，已学单词照常按时复习。</p>
        </div>
        {selected && (
          <button className="link" onClick={() => select(null)}>
            改用完整图鉴
          </button>
        )}
      </div>
      {progress.session && !progress.session.finished && (
        <p className="notebook-session-note">
          还有一轮未完成（{progress.session.source?.name ?? "完整图鉴"}
          ）。更换词本会在下一轮生效。
          <button className="link" onClick={() => go({ page: "learn" })}>
            继续这一轮 <ArrowRight size={14} />
          </button>
        </p>
      )}
      <div className="notebooks-layout">
        <aside className="notebook-shelf" aria-label="我的词本列表">
          {progress.notebooks.map((book, i) => {
            const fresh = book.wordIds.filter(
              (id) =>
                atlas.byId.has(id) &&
                !progress.cards[id] &&
                !progress.familiar.includes(id),
            ).length;
            return (
              <section
                className={`notebook-tile ${book.id === current?.id && !creating ? "is-open" : ""}`}
                key={book.id}
              >
                <button
                  className="notebook-open"
                  onClick={() => {
                    setCreating(false);
                    go({ page: "notebooks", book: book.id, add: route.add });
                  }}
                  aria-label={`打开词本 ${book.name}`}
                >
                  <span
                    className={`notebook-spine tone-${i % 3}`}
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <b>{book.name}</b>
                    <small>
                      {book.wordIds.length} 个词 · {fresh} 个未学
                    </small>
                    {book.id === progress.activeNotebookId && (
                      <em>
                        <Check size={12} /> 今日在学
                      </em>
                    )}
                  </span>
                </button>
                {pending && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => addPending(book)}
                    disabled={book.wordIds.includes(pending.id)}
                  >
                    {book.wordIds.includes(pending.id)
                      ? "已经收录"
                      : "收进这个词本"}
                  </button>
                )}
              </section>
            );
          })}
          {!progress.notebooks.length && (
            <p className="muted notebook-shelf-empty">
              还没有词本。
              <br />
              先给你想学的词起一个名字。
            </p>
          )}
        </aside>
        {creating ? (
          <NewNotebook
            key={pending?.id ?? "new"}
            atlas={atlas}
            pendingId={pending?.id}
            onDone={(id) => {
              setCreating(false);
              go({ page: "notebooks", book: id });
            }}
            onCancel={() => setCreating(false)}
          />
        ) : current ? (
          <NotebookDetail
            key={current.id}
            book={current}
            onSelect={() => select(current.id)}
          />
        ) : (
          <section className="notebook-welcome panel">
            <div className="notebook-cover" aria-hidden="true">
              <span>拾 词</span>
              <b>
                Words
                <br />
                worth keeping.
              </b>
              <i>文章 · 课程 · 生活</i>
            </div>
            <h2>从你真正想学的词开始。</h2>
            <p className="muted">
              粘贴英语单词或短语，自动匹配图鉴里的释义、插画与发音。收藏的词也能一键收进来。
            </p>
            <button className="btn btn-ghost" onClick={() => setCreating(true)}>
              创建我的第一本 <ArrowRight size={18} />
            </button>
          </section>
        )}
      </div>
      <p className="notebook-footnote">
        词本和进度保存在这个浏览器。换设备前，在「我的」导出备份。
      </p>
    </div>
  );
}

function MatchPreview({ text, atlas }: { text: string; atlas: Atlas }) {
  const result = useMemo(() => matchWords(text, atlas), [text, atlas]);
  if (!text.trim()) return null;
  return (
    <div className="match-preview" aria-live="polite">
      <p>
        <b>匹配到 {result.wordIds.length} 个词</b>
        {result.duplicates > 0 && <span> · 已去重 {result.duplicates} 项</span>}
      </p>
      {!!result.wordIds.length && (
        <p className="match-words" lang="en">
          {result.wordIds
            .slice(0, 12)
            .map((id) => atlas.byId.get(id)!.word)
            .join(" · ")}
          {result.wordIds.length > 12 ? " …" : ""}
        </p>
      )}
      {!!result.unmatched.length && (
        <details className="match-unmatched">
          <summary>未收录 {result.unmatched.length} 项，展开查看</summary>
          <p>{result.unmatched.join("、")}</p>
          <small>这些词暂时不会导入。请检查拼写；短语请保持完整。</small>
        </details>
      )}
    </div>
  );
}

function NewNotebook({
  atlas,
  pendingId,
  onDone,
  onCancel,
}: {
  atlas: Atlas;
  pendingId?: string;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  return (
    <form
      className="panel notebook-editor"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || store.get().progress.notebooks.length >= 100)
          return;
        const ids = matchWords(text, atlas).wordIds;
        const book = makeNotebook(name, pendingId ? [pendingId, ...ids] : ids);
        store.progress((p) => ({ ...p, notebooks: [...p.notebooks, book] }));
        toast(`「${book.name}」建好了，收录 ${book.wordIds.length} 个词`, "ok");
        onDone(book.id);
      }}
    >
      <p className="eyebrow">新建词本</p>
      <h2>给这次学习起个名字。</h2>
      <label className="notebook-field">
        词本名称
        <input
          required
          maxLength={60}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：这周的英语阅读"
        />
      </label>
      <WordInput
        value={text}
        onChange={setText}
        label="粘贴单词（可稍后添加）"
      />
      {pendingId && (
        <p className="muted">同时收录：{atlas.byId.get(pendingId)?.word}</p>
      )}
      <MatchPreview text={text} atlas={atlas} />
      <div className="data-actions">
        <button
          className="btn btn-primary"
          type="submit"
          disabled={!name.trim()}
        >
          创建词本 <ArrowRight size={17} />
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

function WordInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="notebook-field">
      {label}
      <textarea
        rows={5}
        maxLength={50000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"library\njourney\nlook forward to"}
        spellCheck={false}
      />
      <small>
        每行一个词，或用逗号、分号分隔；短语中的空格会保留。匹配当前英语图鉴，不会自动生成词条。
      </small>
    </label>
  );
}

function NotebookDetail({
  book,
  onSelect,
}: {
  book: Notebook;
  onSelect: () => void;
}) {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const [name, setName] = useState(book.name);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(40);
  const result = useMemo(() => matchWords(text, atlas), [text, atlas]);
  const words = book.wordIds.map((id) => atlas.byId.get(id)).filter((w) => !!w);
  const list = words.filter(
    (w) =>
      !q.trim() ||
      `${w.word} ${w.zh}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const fresh = words.filter(
    (w) => !progress.cards[w.id] && !progress.familiar.includes(w.id),
  ).length;
  const familiar = words.filter((w) => progress.familiar.includes(w.id)).length;
  const add = (ids: string[]) => {
    const count = ids.filter((id) => !book.wordIds.includes(id)).length;
    store.progress((p) => addWords(p, book.id, ids));
    toast(
      count ? `已收进 ${count} 个词` : "这些词已经在词本里了",
      count ? "ok" : "info",
    );
  };
  return (
    <section className="panel notebook-detail">
      <div className="panel-head">
        <p className="eyebrow">我的词本</p>
        <button
          className="icon-btn"
          aria-label={`删除词本 ${book.name}`}
          onClick={() => {
            if (
              !confirm(
                `删除「${book.name}」？已学单词、收藏和复习计划会保留。${progress.activeNotebookId === book.id ? "今日新词来源将改为完整图鉴。" : ""}`,
              )
            )
              return;
            store.progress((p) => removeNotebook(p, book.id));
            go({ page: "notebooks" });
            toast("词本已删除，学习记录已保留");
          }}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <h2>{book.name}</h2>
      <p className="notebook-count">
        {words.length} 个词 <i> / </i> {fresh} 个未学 <i> / </i> {familiar}{" "}
        个已熟悉
      </p>
      <button
        className={`btn ${book.id === progress.activeNotebookId ? "btn-ghost" : "btn-primary"}`}
        onClick={onSelect}
        disabled={book.id === progress.activeNotebookId}
      >
        {book.id === progress.activeNotebookId ? (
          <>
            <Check size={17} /> 今日在学
          </>
        ) : (
          <>
            用这个词本学新词 <ArrowRight size={17} />
          </>
        )}
      </button>
      <details className="notebook-manage">
        <summary>添加单词 / 修改名称</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            store.progress((p) => ({
              ...p,
              notebooks: p.notebooks.map((b) =>
                b.id === book.id
                  ? { ...b, name: name.trim(), updated: Date.now() }
                  : b,
              ),
            }));
            toast("名称已保存", "ok");
          }}
        >
          <label className="notebook-field">
            词本名称
            <input
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            className="btn btn-ghost"
            type="submit"
            disabled={!name.trim() || name.trim() === book.name}
          >
            保存名称
          </button>
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(result.wordIds);
            if (!result.unmatched.length) setText("");
          }}
        >
          <WordInput value={text} onChange={setText} label="粘贴单词" />
          <MatchPreview text={text} atlas={atlas} />
          <div className="data-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!result.wordIds.length}
            >
              收进匹配的词
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={
                !progress.bookmarks.some(
                  (id) => atlas.byId.has(id) && !book.wordIds.includes(id),
                )
              }
              onClick={() =>
                add(progress.bookmarks.filter((id) => atlas.byId.has(id)))
              }
            >
              从收藏加入
            </button>
          </div>
        </form>
      </details>
      <div className="notebook-words-head">
        <h3 className="eyebrow">词本里的词</h3>
        <input
          aria-label="搜索本词本"
          placeholder="搜索本词本"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(40);
          }}
        />
      </div>
      <ul className="notebook-words">
        {list.slice(0, limit).map((w) => {
          const card = progress.cards[w.id];
          const known = progress.familiar.includes(w.id);
          const status = card
            ? isMastered(card)
              ? "已掌握"
              : "学习中"
            : known
              ? "已熟悉"
              : "未学";
          return (
            <li key={w.id}>
              <button className="notebook-word" onClick={() => openWord(w.id)}>
                <b lang="en">{w.word}</b>
                <span>{w.zh}</span>
                <small className={known ? "is-familiar" : ""}>{status}</small>
              </button>
              {!card && (
                <button
                  className="notebook-word-action link"
                  onClick={() =>
                    store.progress((p) => setFamiliar(p, w.id, !known))
                  }
                >
                  {known ? "恢复学习" : "标为熟词"}
                </button>
              )}
              <button
                className="icon-btn"
                aria-label={`从词本移除 ${w.word}`}
                onClick={() => {
                  store.progress((p) => ({
                    ...p,
                    notebooks: p.notebooks.map((b) =>
                      b.id === book.id
                        ? {
                            ...b,
                            wordIds: b.wordIds.filter((id) => id !== w.id),
                            updated: Date.now(),
                          }
                        : b,
                    ),
                  }));
                  toast("已移出词本，学习记录保留");
                }}
              >
                <Trash2 size={15} />
              </button>
            </li>
          );
        })}
      </ul>
      {!list.length && (
        <p className="muted notebook-empty">
          {q
            ? "没有找到这个词。"
            : "这里还是空的。展开上面的「添加单词」，把想学的词收进来。"}
        </p>
      )}
      {list.length > limit && (
        <button
          className="btn btn-ghost"
          onClick={() => setLimit((n) => n + 40)}
        >
          再显示 40 个
        </button>
      )}
      <p className="notebook-footnote">
        标为熟词后不再安排为新词，可随时恢复。移出词本不会删除学习记录。
      </p>
      <button className="link" onClick={() => go({ page: "today" })}>
        <ChevronLeft size={15} /> 回到今日，开始学习
      </button>
    </section>
  );
}
