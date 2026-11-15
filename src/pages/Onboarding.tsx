import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useAtlas } from "../atlas/context";
import { store } from "../store/store";

const LEVELS = [
  ["A1", "从头开始", "先把常用词记扎实"],
  ["A2", "有一点基础", "日常词还不太稳"],
  ["B1", "继续进阶", "能读懂简单文章"],
  ["B2", "挑战难一点", "想拓展阅读词汇"],
];

export function Onboarding() {
  const atlas = useAtlas();
  const [level, setLevel] = useState(0);
  const [goal, setGoal] = useState(10);
  const finish = () => store.settings({ onboarded: true, startLevel: atlas.cefr.indexOf(LEVELS[level][0]), dailyNew: goal });
  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="欢迎">
      <div className="onboard-card">
        <img className="onboard-art" src={`${import.meta.env.BASE_URL}brand/hero.webp`} alt="" />
        <div className="onboard-body">
          <p className="eyebrow">拾词 · 我的英语学习本</p>
          <h1 className="display">
            每天十个词，
            <br />
            慢慢变成自己的。
          </h1>
          <fieldset>
            <legend>你从哪里出发？</legend>
            <div className="choice-grid">
              {LEVELS.map(([code, name, desc], i) => (
                <button key={code} className={`choice ${level === i ? "is-on" : ""}`} onClick={() => setLevel(i)} aria-pressed={level === i}>
                  <span className={`chip chip-level lv-${code}`}>{code}</span>
                  <b>{name}</b>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>每天点亮几颗新星？</legend>
            <div className="segmented segmented-wide">
              {[5, 10, 15, 20].map((n) => (
                <button key={n} className={goal === n ? "is-on" : ""} onClick={() => setGoal(n)} aria-pressed={goal === n}>
                  {n} 颗{n === 10 ? " · 推荐" : ""}
                </button>
              ))}
            </div>
          </fieldset>
          <button className="btn btn-primary btn-xl" onClick={finish}>
            出发 <ArrowRight size={20} />
          </button>
          <p className="muted">{atlas.count.toLocaleString()} 个英语词，配插画、例句和发音。进度留在本机，请在「我的」定期导出备份。目标和难度随时能改。</p>
        </div>
      </div>
    </div>
  );
}
