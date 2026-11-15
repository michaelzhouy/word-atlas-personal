import { Check, Smartphone, Wifi, WifiOff } from "lucide-react";
import { installApp, useInstall } from "../lib/install";
import { toast } from "./Toast";

export function InstallPanel() {
  const { online, ready, installed, canInstall } = useInstall();
  return (
    <section className="panel install-panel" aria-labelledby="install-title">
      <div className="panel-head">
        <h3 className="eyebrow" id="install-title">
          随身带着拾词
        </h3>
        <span className="connection-state" role="status">
          {online ? <Wifi size={15} /> : <WifiOff size={15} />}
          {online ? "已联网" : "离线中"}
        </span>
      </div>
      <h4>{installed ? "已经在你的桌面上。" : "像 App 一样，一点就打开。"}</h4>
      {installed ? (
        <p className="install-ready">
          <Check size={16} /> 已在独立窗口中打开
        </p>
      ) : (
        <>
          {canInstall && (
            <button
              className="btn btn-primary"
              onClick={() =>
                void installApp().catch(() =>
                  toast("请用浏览器菜单添加到主屏幕。", "warn"),
                )
              }
            >
              <Smartphone size={18} /> 安装拾词
            </button>
          )}
          <ol className="install-steps">
            <li>
              <b>iPhone / iPad</b>
              <span>用 Safari 打开，点「分享」→「添加到主屏幕」。</span>
            </li>
            <li>
              <b>Android</b>
              <span>
                用 Chrome 打开，点右上角菜单 →「添加到主屏幕」或「安装应用」。
              </span>
            </li>
          </ol>
        </>
      )}
      <p className="muted">
        {ready ? "离线入口已准备好。" : "首次请联网打开，等离线入口准备好。"}
        离线可用范围是已缓存的词卡和音频，未打开过的内容仍需要网络。浏览器可能清理缓存，请定期备份学习记录。
      </p>
    </section>
  );
}
