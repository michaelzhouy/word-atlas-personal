import type { Entry } from "../atlas/types";

/** A dictionary headword with room for German noun forms when supplied. */
export function WordIdentity({
  entry,
  language = "en",
}: {
  entry: Pick<Entry, "w" | "grammar">;
  language?: "en" | "de";
}) {
  return (
    <div className="word-identity" lang={language}>
      <h2 className="headword">
        {entry.grammar?.article && (
          <span className="word-article">{entry.grammar.article} </span>
        )}
        {entry.w}
      </h2>
      {entry.grammar?.plural && (
        <p className="word-plural">
          <span lang="zh-CN">复数</span> {entry.grammar.plural}
        </p>
      )}
    </div>
  );
}
