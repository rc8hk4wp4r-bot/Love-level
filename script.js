document.addEventListener("DOMContentLoaded", () => {
  // ====== 設定：Worker API の URL ======
  const API_BASE = "https://lovelevel-api.rc8hk4wp4r.workers.dev";

  // ====== キャラデータ ======
  const characters = [
    { id: "lisa", name: "理沙", initials: "リ", desc: "26歳 / 広告代理店", headerSub: "カフェ好き女子" },
    { id: "miyu", name: "美優", initials: "ミ", desc: "25歳 / 保育士", headerSub: "ふわふわ系" },
    { id: "kana", name: "香奈", initials: "カ", desc: "27歳 / デザイナー", headerSub: "映画好き" }
  ];

  // 各キャラごとのチャット履歴
  const histories = {};
  characters.forEach(c => {
    histories[c.id] = [
      { from: c.id, text: `はじめまして、${c.name}です☺️` }
    ];
  });

  // 各キャラごとの好感度 & ステージ & ゲーム終了フラグ & 最後のアドバイス
  const scores = { lisa: 50, miyu: 50, kana: 50 };
  const stages = { lisa: 1, miyu: 1, kana: 1 };
  const gameEnded = { lisa: false, miyu: false, kana: false };
  const lastAdvice = { lisa: "", miyu: "", kana: "" };

  let currentCharacterId = null;
  let currentScore = 50;
  let currentStage = 1;

  // ====== DOM 要素 ======
  const appEl = document.getElementById("appRoot");
  const characterListEl = document.getElementById("characterList");
  const chatBodyEl = document.getElementById("chatBody");
  const chatHeaderNameEl = document.getElementById("chatHeaderName");
  const chatHeaderSubEl = document.getElementById("chatHeaderSub");
  const chatHeaderAvatarEl = document.getElementById("chatHeaderAvatar");
  const messageInputEl = document.getElementById("messageInput");
  const sendButtonEl = document.getElementById("sendButton");
  const backButtonEl = document.getElementById("backButton");

  // ツールバー
  const statusButtonEl = document.getElementById("statusButton");
  const analyzeButtonEl = document.getElementById("analyzeButton");
  const endGameButtonEl = document.getElementById("endGameButton");

  // アドバイスバー
  const adviceBarEl = document.getElementById("adviceBar");
  const adviceTextEl = document.getElementById("adviceText");

  // モーダル
  const modalOverlayEl = document.getElementById("modalOverlay");
  const modalTitleEl = document.getElementById("modalTitle");
  const modalBodyEl = document.getElementById("modalBody");
  const modalCloseButtonEl = document.getElementById("modalCloseButton");
  const modalPrimaryButtonEl = document.getElementById("modalPrimaryButton");

  // 要素が取れてないときは何もしない（真っ白防止）
  if (!appEl || !characterListEl || !chatBodyEl) {
    console.error("必要なDOM要素が見つからないので初期化を中断しました。");
    return;
  }

  // ====== API 呼び出し（会話 + スコア） ======
  async function sendToCharacter(characterId, userMessage) {
    const res = await fetch(`${API_BASE}/api/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId,
        userMessage,
        score: currentScore,
        stage: currentStage
      }),
    });

    if (!res.ok) {
      console.error("API Error:", res.status);
      throw new Error("API error");
    }

    return await res.json(); // { lisaMessage, score, scoreDelta, stage, advice, flags }
  }

  // ====== ステータス系 ======
  function getRank(score) {
    if (score >= 80) return "S";
    if (score >= 65) return "A";
    if (score >= 50) return "B";
    if (score >= 35) return "C";
    return "D";
  }

  function getStatusComment(score) {
    if (score >= 80) return "ほぼ口説き落とせてるレベル。告白タイミングをうかがってもいいかも。";
    if (score >= 65) return "かなりいい感じ。相手のペースも大事にしつつ距離を詰めていこう。";
    if (score >= 50) return "会話としては悪くない。相手の話をもう一歩深掘りするとさらに◎。";
    if (score >= 35) return "まだ探り探りな状態。共感と質問を少し意識すると良くなりそう。";
    return "まだ距離が遠いかも。まずは相手の話をよく聞いて、安心感を出していこう。";
  }

  // ====== モーダル ======
  function openModal(title, body, showPrimary = false, primaryLabel = "OK", primaryHandler = null) {
    if (!modalOverlayEl || !modalTitleEl || !modalBodyEl) return;

    modalTitleEl.textContent = title;
    modalBodyEl.textContent = body;

    if (showPrimary && primaryHandler) {
      modalPrimaryButtonEl?.classList.remove("hidden");
      if (modalPrimaryButtonEl) {
        modalPrimaryButtonEl.textContent = primaryLabel;
        modalPrimaryButtonEl.onclick = () => {
          primaryHandler();
          closeModal();
        };
      }
    } else if (modalPrimaryButtonEl) {
      modalPrimaryButtonEl.classList.add("hidden");
      modalPrimaryButtonEl.onclick = null;
    }

    modalOverlayEl.classList.remove("hidden");
    modalOverlayEl.style.display = "flex";
  }

  function closeModal() {
    if (!modalOverlayEl) return;
    modalOverlayEl.classList.add("hidden");
    modalOverlayEl.style.display = "none";
  }

  // ====== アドバイスバー表示 ======
  function showAdviceBar(text) {
    if (!adviceBarEl || !adviceTextEl) return;

    if (!text) {
      adviceBarEl.classList.add("hidden");
      adviceTextEl.textContent = "";
      return;
    }
    adviceTextEl.textContent = text;
    adviceBarEl.classList.remove("hidden");
  }

  // ====== UI 描画 ======
  function renderCharacterList() {
    characterListEl.innerHTML = "";
    characters.forEach(c => {
      const item = document.createElement("div");
      item.className = "character-item" + (c.id === currentCharacterId ? " active" : "");
      item.dataset.id = c.id;

      item.innerHTML = `
        <div class="avatar"><span>${c.initials}</span></div>
        <div class="character-meta">
          <div class="character-name">${c.name}</div>
          <div class="character-desc">${c.desc}</div>
        </div>
      `;

      item.onclick = () => selectCharacter(c.id);
      characterListEl.appendChild(item);
    });
  }

  function renderChat() {
    chatBodyEl.innerHTML = "";

    if (!currentCharacterId) {
      const wrapper = document.createElement("div");
      wrapper.style.height = "100%";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "center";

      const card = document.createElement("div");
      card.style.background = "#ffffff";
      card.style.borderRadius = "16px";
      card.style.padding = "16px 20px";
      card.style.boxShadow = "0 4px 12px rgba(15,23,42,0.08)";
      card.style.maxWidth = "320px";
      card.style.textAlign = "center";
      card.style.fontSize = "14px";
      card.style.color = "#4b5563";

      card.innerHTML = `
        <div style="font-weight:600; margin-bottom:4px;">相手を選んでください</div>
        <div style="font-size:12px; color:#9ca3af;">
          マッチ一覧から話したい子をタップすると<br>チャットが始まります。
        </div>
      `;

      wrapper.appendChild(card);
      chatBodyEl.appendChild(wrapper);
      showAdviceBar(""); // 何も表示しない
      return;
    }

    const logs = histories[currentCharacterId] || [];

    logs.forEach(msg => {
      const row = document.createElement("div");
      row.className = "message-row " + (msg.from === "me" ? "me" : "");

      const bubble = document.createElement("div");
      bubble.className = "bubble " + (msg.from === "me" ? "me" : "lisa");
      bubble.textContent = msg.text;

      row.appendChild(bubble);
      chatBodyEl.appendChild(row);
    });

    chatBodyEl.scrollTop = chatBodyEl.scrollHeight;
  }

  // ====== キャラ選択 ======
  function selectCharacter(id) {
    currentCharacterId = id;
    const c = characters.find(x => x.id === id);

    if (chatHeaderAvatarEl) chatHeaderAvatarEl.innerHTML = `<span>${c.initials}</span>`;
    if (chatHeaderNameEl) chatHeaderNameEl.textContent = c.name;
    if (chatHeaderSubEl) chatHeaderSubEl.textContent = c.headerSub;

    if (messageInputEl) messageInputEl.disabled = false;
    if (sendButtonEl) sendButtonEl.disabled = false;

    currentScore = scores[id];
    currentStage = stages[id];

    renderCharacterList();
    renderChat();

    // そのキャラの最後のアドバイスがあれば表示
    showAdviceBar(lastAdvice[id] || "");

    if (window.innerWidth <= 768) {
      appEl.classList.add("show-chat");
    }
  }

  // ====== 送信処理 ======
  async function handleSend() {
    const text = messageInputEl?.value.trim();
    if (!text || !currentCharacterId) return;

    if (gameEnded[currentCharacterId]) {
      openModal("ゲームは終了しています", "もう一度この子と話したい場合は、結果画面からリセットしてください。");
      return;
    }

    histories[currentCharacterId].push({ from: "me", text });
    if (messageInputEl) messageInputEl.value = "";
    renderChat();

    try {
      const data = await sendToCharacter(currentCharacterId, text);

      if (typeof data.score === "number") {
        currentScore = data.score;
        scores[currentCharacterId] = data.score;
      }
      if (typeof data.stage === "number") {
        currentStage = data.stage;
        stages[currentCharacterId] = data.stage;
      }
      if (typeof data.advice === "string" && data.advice.trim()) {
        lastAdvice[currentCharacterId] = data.advice.trim();
        showAdviceBar(data.advice.trim());
      }

      histories[currentCharacterId].push({
        from: currentCharacterId,
        text: data.lisaMessage || "うまく返事ができなかったみたい…",
      });
    } catch (e) {
      console.error(e);
      histories[currentCharacterId].push({
        from: currentCharacterId,
        text: "ごめん、ちょっと接続エラーが出ちゃったみたい…😭",
      });
    }

    renderChat();
  }

  // ====== チャット分析（ローカル簡易版） ======
  function buildAnalysisText() {
    if (!currentCharacterId) {
      return "まずは誰かと話してみてね。";
    }

    const logs = histories[currentCharacterId] || [];
    const myMessages = logs.filter(m => m.from === "me");

    if (myMessages.length === 0) {
      return "まだメッセージが少ないから、もう少し話してから分析してみよう。";
    }

    let totalLen = 0;
    let questionCount = 0;
    let thanksCount = 0;
    let nameCount = 0;

    const c = characters.find(x => x.id === currentCharacterId);

    myMessages.forEach(m => {
      const t = m.text;
      totalLen += t.length;
      if (t.includes("？") || t.includes("?")) questionCount++;
      if (t.includes("ありがとう") || t.includes("ありがと")) thanksCount++;
      if (c && t.includes(c.name)) nameCount++;
    });

    const avgLen = Math.round(totalLen / myMessages.length);
    let summary = "";

    summary += `・メッセージ数：${myMessages.length}\n`;
    summary += `・平均文字数：約${avgLen}文字\n`;
    summary += `・質問した回数：${questionCount}\n`;
    summary += `・名前を呼んだ回数：${nameCount}\n`;
    summary += `・「ありがとう」を伝えた回数：${thanksCount}\n\n`;

    if (questionCount === 0) {
      summary += "▶ 質問がほとんどないので、相手の話を広げる質問を1つ入れてみると良さそう。\n";
    } else if (questionCount > myMessages.length / 2) {
      summary += "▶ 質問が多めなので、たまに自分の話も混ぜるとバランス良くなるかも。\n";
    }

    if (avgLen > 80) {
      summary += "▶ 1メッセージが長めかも。もう少し短く区切ると、LINEっぽいテンポになるよ。\n";
    } else if (avgLen < 20) {
      summary += "▶ かなり短文が多いので、もう一言だけ足してみると気持ちが伝わりやすい。\n";
    }

    if (thanksCount === 0) {
      summary += "▶ 「ありがとう」を1回入れるだけでも、印象が結構変わるよ。\n";
    }

    return summary;
  }

  // ====== ステータス表示 ======
  function showStatusModal() {
    if (!currentCharacterId) {
      openModal("ステータス", "まずは誰かを選んで話しかけてみてね。");
      return;
    }

    const score = scores[currentCharacterId];
    const rank = getRank(score);
    const comment = getStatusComment(score);
    const c = characters.find(x => x.id === currentCharacterId);

    let text =
      `【${c.name} との恋愛偏差値】\n` +
      `スコア：${score} / 100（ランク：${rank}）\n\n` +
      comment;

    openModal("現在のステータス", text);
  }

  // ====== ゲーム終了（結果発表） ======
  function endCurrentGame() {
    if (!currentCharacterId) {
      openModal("ゲーム終了", "まずは誰かと話してからゲームを終了してね。");
      return;
    }

    if (gameEnded[currentCharacterId]) {
      openModal("ゲームはすでに終了しています", "この子との結果はもう発表済みだよ。");
      return;
    }

    const c = characters.find(x => x.id === currentCharacterId);
    const score = scores[currentCharacterId];
    const rank = getRank(score);
    const comment = getStatusComment(score);
    const analysis = buildAnalysisText();
    const advice = lastAdvice[currentCharacterId];

    let text =
      `【${c.name} との最終結果】\n` +
      `恋愛偏差値：${score} / 100（ランク：${rank}）\n\n` +
      `${comment}\n\n` +
      `―― チャットのざっくり分析 ――\n` +
      analysis;

    if (advice) {
      text += `\n―― 最後のワンポイントアドバイス ――\n${advice}\n`;
    }

    gameEnded[currentCharacterId] = true;

    openModal(
      "ゲーム結果",
      text,
      true,
      "もう一度この子と話す",
      () => resetCharacterGame(currentCharacterId)
    );
  }

  // ゲームリセット
  function resetCharacterGame(id) {
    const c = characters.find(x => x.id === id);
    histories[id] = [
      { from: id, text: `はじめまして、${c.name}です☺️` }
    ];
    scores[id] = 50;
    stages[id] = 1;
    gameEnded[id] = false;
    lastAdvice[id] = "";

    if (currentCharacterId === id) {
      currentScore = 50;
      currentStage = 1;
      renderChat();
      showAdviceBar("");
    }
  }

  // ====== イベント設定 ======
  if (sendButtonEl) {
    sendButtonEl.onclick = handleSend;
  }

  if (messageInputEl) {
    messageInputEl.onkeydown = e => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    };
  }

  if (backButtonEl) {
    backButtonEl.onclick = () => {
      appEl.classList.remove("show-chat");
      currentCharacterId = null;

      if (chatHeaderAvatarEl) chatHeaderAvatarEl.innerHTML = "<span>？</span>";
      if (chatHeaderNameEl) chatHeaderNameEl.textContent = "相手を選んでください";
      if (chatHeaderSubEl) chatHeaderSubEl.textContent = "リストから選ぶと開始します";

      if (messageInputEl) {
        messageInputEl.value = "";
        messageInputEl.disabled = true;
      }
      if (sendButtonEl) sendButtonEl.disabled = true;

      renderCharacterList();
      renderChat();
    };
  }

  if (statusButtonEl) statusButtonEl.onclick = showStatusModal;

  if (analyzeButtonEl) {
    analyzeButtonEl.onclick = () => {
      if (!currentCharacterId) {
        openModal("チャット分析", "まずは誰かを選んで話しかけてみてね。");
        return;
      }
      const c = characters.find(x => x.id === currentCharacterId);
      const analysis = buildAnalysisText();
      openModal(`【${c.name} とのチャット分析】`, analysis);
    };
  }

  if (endGameButtonEl) endGameButtonEl.onclick = endCurrentGame;

  if (modalCloseButtonEl) modalCloseButtonEl.onclick = closeModal;
  if (modalOverlayEl) {
    modalOverlayEl.onclick = (e) => {
      if (e.target === modalOverlayEl) closeModal();
    };
  }

  // ====== 画面幅変更 ======
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      appEl.classList.remove("show-chat");
    }
  });

  // ====== 初期表示 ======
  renderCharacterList();
  renderChat();
  showAdviceBar("");
  closeModal(); // 念のため閉じておく
});
