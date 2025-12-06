// ゲーム状態
let state = {
  score: 0,
  stage: 1,
  turn: 0,
  finished: false
};

const chatEl = document.getElementById("chat");
const scoreEl = document.getElementById("score");
const stageEl = document.getElementById("stage");
const turnEl = document.getElementById("turn");
const resultEl = document.getElementById("result");
const inputEl = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

// 画面にメッセージを追加
function addMessage(who, text) {
  const div = document.createElement("div");
  div.className = "message " + (who === "lisa" ? "lisa" : "user");
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// スコアからステージを計算（仕様の簡易版）
function calcStage(score) {
  if (score <= 10) return 1;
  if (score <= 30) return 2;
  if (score <= 60) return 3;
  if (score <= 85) return 4;
  return 5;
}

// ユーザーの発言を採点して、理沙の返答も決める「なんちゃってAPI」
function localTurn(userMessage) {
  state.turn += 1;

  let delta = 0;
  let isInvitation = false;

  const msg = userMessage.trim();

  // めちゃ簡単な採点ルール
  if (msg.includes("ありがとう")) delta += 4;
  if (msg.includes("はじめまして") || msg.includes("よろしく")) delta += 4;
  if (msg.includes("カフェ") || msg.includes("映画")) delta += 5;
  if (msg.length > 0 && msg.length < 6) delta -= 1; // ぶっきらぼう
  if (msg.includes("理沙ちゃん") || msg.includes("りさちゃん")) delta -= 8;
  if (msg.includes("会いませんか") || msg.includes("行きませんか") || msg.includes("行かない")) {
    isInvitation = true;
    delta += 3; // 誘ったこと自体はプラス
  }

  state.score += delta;
  if (state.score > 100) state.score = 100;
  if (state.score < -50) state.score = -50;

  state.stage = calcStage(state.score);

  // 終了判定（簡易版）
  let endType = "none";
  if (state.score <= -50) {
    endType = "fail";
    state.finished = true;
  } else if (isInvitation) {
    if (state.score >= 80) {
      endType = "success";
      state.finished = true;
    } else if (state.score >= 50) {
      endType = "hold";
      state.finished = true;
    } else {
      endType = "fail";
      state.finished = true;
    }
  }

  // 理沙の返答を決める
  let lisaText = "";

  if (!state.finished) {
    lisaText = generateLisaReply(msg, state.stage);
  } else {
    lisaText = generateEndMessage(endType);
  }

  const resultSummary = state.finished
    ? makeResultSummary(endType)
    : null;

  return {
    lisaMessage: lisaText,
    score: state.score,
    stage: state.stage,
    turn: state.turn,
    isFinished: state.finished,
    endType,
    resultSummary
  };
}

// ステージごとの理沙の返答（超シンプル版）
function generateLisaReply(userMsg, stage) {
  // まずは話題に応じてざっくり返す
  if (userMsg.includes("カフェ")) {
    if (stage >= 3) {
      return "カフェいいですよね。落ち着いたお店でのんびりするの好きです☺️";
    }
    return "カフェ、落ち着きますよね。よく行かれるんですか？";
  }

  if (userMsg.includes("映画")) {
    if (stage >= 3) {
      return "映画はサスペンス多めで観ることが多いです。◯◯さんはどんなのが好きですか？";
    }
    return "映画も好きですよ。ゆっくり観られる作品が多いかもです。";
  }

  if (userMsg.includes("仕事")) {
    return "仕事は広告の企画みたいなことをしてます。バタバタしますけど、けっこう楽しいですよ。";
  }

  // デフォルト返答（ステージ別の雰囲気だけ変える）
  switch (stage) {
    case 1:
      return "ありがとうございます。まずは、いろいろお話できたら嬉しいです。";
    case 2:
      return "なるほど、そうなんですね。休みの日はどう過ごされることが多いですか？";
    case 3:
      return "◯◯さんと話してると、なんか落ち着きますね☺️";
    case 4:
      return "うん、◯◯さんと話してると楽しいから、つい色々聞きたくなります☺️";
    case 5:
      return "◯◯さんとは、価値観合いそうだなって思ってました。";
    default:
      return "そうなんですね。教えてくださってありがとうございます。";
  }
}

// エンドメッセージ
function generateEndMessage(endType) {
  if (endType === "success") {
    return "うん、行きたいな☺️ きっと楽しいと思います。";
  }
  if (endType === "hold") {
    return "誘ってくださって嬉しいです。もう少しお話してから考えられたら嬉しいです。";
  }
  return "まだお互いのことがよくわからないので、いきなり会うのは難しいかなと思っています…。ごめんなさい。";
}

// 結果サマリ（テキトー版）
function makeResultSummary(endType) {
  const loveScore = Math.round(state.score * 0.85);
  let comment = "";
  let strengths = [];
  let improvements = [];
  let advice = "";

  if (endType === "success") {
    comment = "自然な距離感で好感度を上げて、いいタイミングで誘えています。";
    strengths.push("相手のことを気遣った丁寧なメッセージが多かったです。");
    strengths.push("会話の流れの中で誘えていました。");
    advice = "序盤でもう少し自己開示を増やすと、さらに距離が縮まりやすくなります。";
  } else if (endType === "hold") {
    comment = "丁寧で悪くないやり取りでしたが、もう一歩踏み込んだ会話があると誘いが通りやすくなりそうです。";
    strengths.push("失礼のない丁寧な話し方ができていました。");
    improvements.push("自分のことも少しずつ話して、距離を縮めてから誘うと良いです。");
    advice = "まずは趣味や休日の過ごし方など、価値観の話を増やしてみましょう。";
  } else {
    comment = "少し距離の詰め方やタイミングが合わなかったかもしれません。";
    improvements.push("いきなりの誘いではなく、何ターンか雑談してから誘うと良いです。");
    advice = "最初の数ターンは、丁寧さと相手への質問を意識してみてください。";
  }

  return {
    loveScore,
    comment,
    strengths,
    improvements,
    advice
  };
}

// 送信処理
async function handleSend() {
  const text = inputEl.value.trim();
  if (!text || state.finished) return;

  addMessage("user", text);
  inputEl.value = "";
  inputEl.focus();

  sendBtn.disabled = true;

  // 本来はここで fetch('/api/turn') を呼ぶイメージ
  const data = localTurn(text);

  addMessage("lisa", data.lisaMessage);

  scoreEl.textContent = data.score;
  stageEl.textContent = data.stage;
  turnEl.textContent = data.turn;

  if (data.isFinished && data.resultSummary) {
    const r = data.resultSummary;
    resultEl.innerHTML = `
      <div><strong>恋愛偏差値:</strong> ${r.loveScore}</div>
      <div style="margin-top:4px;">${r.comment}</div>
      ${r.strengths?.length ? `<div style="margin-top:4px;"><strong>良かった点</strong><br>- ${r.strengths.join("<br>- ")}</div>` : ""}
      ${r.improvements?.length ? `<div style="margin-top:4px;"><strong>改善点</strong><br>- ${r.improvements.join("<br>- ")}</div>` : ""}
      <div style="margin-top:4px;"><strong>アドバイス</strong><br>${r.advice}</div>
    `;
    resultEl.classList.remove("hidden");
  }

  sendBtn.disabled = false;
}

// イベント設定
sendBtn.addEventListener("click", handleSend);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});

// 初期メッセージ
addMessage("lisa", "マッチありがとうございます。よろしくお願いします。");
turnEl.textContent = "0";
