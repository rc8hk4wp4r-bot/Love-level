// script.js

document.addEventListener("DOMContentLoaded", () => {
  // ====== 設定：Cloudflare Worker の URL ======
  const API_BASE = "https://lovelevel-api.rc8hk4wp4r.workers.dev";

  // ゲームルール（10スタート / 60で成功 / 0で失敗）
  const SUCCESS_SCORE = 60;  // 60 で成功
  const FAIL_SCORE = 0;      // 0 になったら失敗
  const INITIAL_SCORE = 10;  // 10 スタート

  // プレミアム機能（特別アドバイス）の解放フラグ（ひとまず全キャラ共通）
  let premiumUnlocked = false;

  // ====== キャラデータ ======
  const characters = [
    { id: "lisa", name: "理沙", initials: "リ", desc: "26歳 / 広告代理店", headerSub: "カフェ好き女子" },
    { id: "miyu", name: "美優", initials: "ミ", desc: "25歳 / 保育士", headerSub: "ふわふわ系" },
    { id: "kana", name: "香奈", initials: "カ", desc: "27歳 / デザイナー", headerSub: "映画好き" }
  ];

  // ====== 状態管理 ======
  // 会話履歴
  const histories = {};
  characters.forEach(c => {
    // 最初はユーザーから話しかけてもらうので空配列
    histories[c.id] = [];
  });

  // 好感度スコア / ステージ / ゲーム終了フラグ / 最後のアドバイス
  const scores = { lisa: INITIAL_SCORE, miyu: INITIAL_SCORE, kana: INITIAL_SCORE };
  const stages = { lisa: 1, miyu: 1, kana: 1 };
  const gameEnded = { lisa: false, miyu: false, kana: false };
  const lastAdvice = { lisa: "", miyu: "", kana: "" };

  let currentCharacterId = null;
  let currentScore = INITIAL_SCORE;
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
  const premiumAdviceButtonEl = document.getElementById("premiumAdviceButton");
  const endGameButtonEl = document.getElementById("endGameButton");

  // ワンポイントアドバイスバー
  const adviceBarEl = document.getElementById("adviceBar");
  const adviceTextEl = document.getElementById("adviceText");

  // モーダル
  const modalOverlayEl = document.getElementById("modalOverlay");
  const modalTitleEl = document.getElementById("modalTitle");
  const modalBodyEl = document.getElementById("modalBody");
  const modalCloseButtonEl = document.getElementById("modalCloseButton");
  const modalPrimaryButtonEl = document.getElementById("modalPrimaryButton");

  // 必須要素が無い場合は処理を中断
  if (!appEl || !characterListEl || !chatBodyEl) {
    console.error("必要なDOM要素が見つからないので初期化を中断しました。");
    return;
  }

  // ====== API 呼び出し（1ターン分） ======
  async function sendToCharacter(characterId, userMessage) {
    const res = await fetch(`${API_BASE}/api/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId,
        userMessage,
        score: currentScore, // 今の好感度を渡す
        stage: currentStage
      }),
    });

    if (!res.ok) {
      console.error("API Error:", res.status);
      throw new Error("API error");
    }

    // Worker からは {lisaMessage, score, scoreDelta, stage, advice} のどれかが返る想定
    const data = await res.json();
    return data;
  }

  // ====== モーダル系 ======
  function openModal(title, body, showPrimary = false, primaryLabel = "OK", primaryHandler = null) {
    if (!modalOverlayEl || !modalTitleEl || !modalBodyEl) return;

    modalTitleEl.textContent = title;
    modalBodyEl.textContent = body;

    if (modalPrimaryButtonEl) {
      if (showPrimary && primaryHandler) {
        modalPrimaryButtonEl.classList.remove("hidden");
        modalPrimaryButtonEl.textContent = primaryLabel;
        modalPrimaryButtonEl.onclick = () => {
          primaryHandler();
          closeModal();
        };
      } else {
        modalPrimaryButtonEl.classList.add("hidden");
        modalPrimaryButtonEl.onclick = null;
      }
    }

    modalOverlayEl.classList.remove("hidden");
    modalOverlayEl.style.display = "flex";
  }

  function closeModal() {
    if (!modalOverlayEl) return;
    modalOverlayEl.classList.add("hidden");
    modalOverlayEl.style.display = "none";
  }

  // ====== アドバイスバー ======
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

  // ====== キャラ一覧描画 ======
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

  // ====== チャット描画 ======
  function renderChat() {
    chatBodyEl.innerHTML = "";

    // まだ誰も選ばれていない
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
      showAdviceBar("");
      return;
    }

    const logs = histories[currentCharacterId] || [];

    // 相手は決まっているが、まだ会話がない
    if (logs.length === 0) {
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
        <div style="font-weight:600; margin-bottom:4px;">話しかけてみよう！</div>
        <div style="font-size:12px; color:#9ca3af;">
          最初のひと言はあなたから。<br>
          あいさつでも、軽い質問でもOKだよ。
        </div>
      `;

      wrapper.appendChild(card);
      chatBodyEl.appendChild(wrapper);
      showAdviceBar("");
      return;
    }

    // 通常の履歴表示
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

    // スマホの場合はチャット画面に切り替え
    if (window.innerWidth <= 768) {
      appEl.classList.add("show-chat");
    }
  }

  // ====== 入力の有効/無効 ======
  function disableInput() {
    if (messageInputEl) {
      messageInputEl.disabled = true;
      messageInputEl.value = "";
    }
    if (sendButtonEl) {
      sendButtonEl.disabled = true;
    }
  }

  function enableInput() {
    if (messageInputEl) {
      messageInputEl.disabled = false;
    }
    if (sendButtonEl) {
      sendButtonEl.disabled = false;
    }
  }

  // ====== チャット送信処理 ======
  async function handleSend() {
    const text = messageInputEl ? messageInputEl.value.trim() : "";
    if (!text || !currentCharacterId) return;

    if (gameEnded[currentCharacterId]) {
      openModal(
        "ゲームは終了しています",
        "この子とのゲームは一度終了しています。\nもう一度遊ぶ場合は、結果画面からリセットしてください。"
      );
      return;
    }

    // 自分のメッセージを追加
    histories[currentCharacterId].push({ from: "me", text });
    if (messageInputEl) messageInputEl.value = "";
    renderChat();

    const c = characters.find(x => x.id === currentCharacterId);

    try {
      const data = await sendToCharacter(currentCharacterId, text);

      // スコア更新ロジック
      // data.score があればそれを採用、なければ scoreDelta を足す
      if (typeof data.score === "number") {
        currentScore = data.score;
      } else if (typeof data.scoreDelta === "number") {
        currentScore = currentScore + data.scoreDelta;
      }

      // 0〜SUCCESS_SCORE にクランプ（マイナスにならない & 上限60）
      currentScore = Math.max(0, Math.min(SUCCESS_SCORE, currentScore));
      scores[currentCharacterId] = currentScore;

      // ステージ更新
      if (typeof data.stage === "number") {
        currentStage = data.stage;
        stages[currentCharacterId] = data.stage;
      }

      // アドバイスがあれば保存 & 表示
      if (typeof data.advice === "string" && data.advice.trim()) {
        lastAdvice[currentCharacterId] = data.advice.trim();
        showAdviceBar(data.advice.trim());
      }

      // 相手のメッセージ
      histories[currentCharacterId].push({
        from: currentCharacterId,
        text: data.lisaMessage || "うまく返事ができなかったみたい…"
      });

      renderChat();

      // ゲーム判定
      checkGameState(c);

    } catch (e) {
      console.error(e);
      histories[currentCharacterId].push({
        from: currentCharacterId,
        text: "ごめん、ちょっと接続エラーが出ちゃったみたい…😭"
      });
      renderChat();
    }
  }

  // ====== ゲーム判定（成功 / 失敗） ======
  function checkGameState(character) {
    if (!character) return;

    if (currentScore >= SUCCESS_SCORE) {
      // 成功
      gameEnded[currentCharacterId] = true;

      const text =
        `${character.name}との会話はかなりいい感じ！\n` +
        `現在のスコア：${currentScore} / ${SUCCESS_SCORE}\n\n` +
        `このままなら告白しても成功しそうな雰囲気です。\n` +
        `どんなアプローチをするか、次の恋愛で試してみよう。`;

      openModal(
        "ゲーム成功 🎉",
        text,
        true,
        "もう一度この子と話す",
        () => resetCharacterGame(currentCharacterId)
      );

      disableInput();
      return;
    }

    if (currentScore <= FAIL_SCORE) {
      // 失敗
      gameEnded[currentCharacterId] = true;

      const text =
        `${character.name}は少し距離を置きたそうな様子…。\n` +
        `現在のスコア：${currentScore} / ${SUCCESS_SCORE}\n\n` +
        `質問攻めや一方的な話になっていなかったか、振り返ってみよう。\n` +
        `「相手に喋らせる」「共感する」を意識すると、次はきっと良くなるはず。`;

      openModal(
        "ゲームオーバー 💔",
        text,
        true,
        "もう一度この子と話す",
        () => resetCharacterGame(currentCharacterId)
      );

      disableInput();
    }
  }

  // ====== チャット分析（簡易ローカル版） ======
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

    summary += `・あなたのメッセージ数：${myMessages.length}\n`;
    summary += `・1メッセージの平均文字数：約${avgLen}文字\n`;
    summary += `・質問した回数：${questionCount}\n`;
    summary += `・名前を呼んだ回数：${nameCount}\n`;
    summary += `・「ありがとう」を伝えた回数：${thanksCount}\n\n`;

    if (questionCount === 0) {
      summary += "▶ 質問がほとんどないので、相手の話を広げる質問を1つ入れてみると良さそう。\n";
    } else if (questionCount > myMessages.length / 2) {
      summary += "▶ 質問が多めなので、たまに自分の話も混ぜるとバランス良くなるかも。\n";
    }

    if (avgLen > 80) {
      summary += "▶ 1メッセージが長めかも。もう少し短く区切るとテンポが良くなるよ。\n";
    } else if (avgLen < 20) {
      summary += "▶ かなり短文が多いので、もう一言だけ足してみると気持ちが伝わりやすい。\n";
    }

    if (thanksCount === 0) {
      summary += "▶ 「ありがとう」を1回入れるだけでも、印象がかなり変わるよ。\n";
    }

    return summary;
  }

  // ====== 特別アドバイス（ロック機能付き） ======
  function buildPremiumAdviceText() {
    if (!currentCharacterId) {
      return "まずは誰かと話してみてね。";
    }

    const c = characters.find(x => x.id === currentCharacterId);
    const logs = histories[currentCharacterId] || [];
    const myMessages = logs.filter(m => m.from === "me");

    let text = "";

    text += `【${c.name} との会話のガチ総評】\n\n`;

    if (myMessages.length === 0) {
      text += "まだ会話がほとんど無いから、まずは5〜10通くらい話してから見てみよう。\n";
      return text;
    }

    // 簡易分析の再利用
    text += buildAnalysisText();
    text += "\n";

    if (currentScore >= 50) {
      text += "▶ 全体的にかなりバランスの良い会話ができているよ。\n";
      text += "　次のステップとしては、相手の価値観や本音に一歩踏み込む質問をしてみると距離が縮みやすい。\n";
    } else if (currentScore >= 30) {
      text += "▶ 悪くはないけど、もう少し『相手に喋ってもらう』意識を強めると良くなりそう。\n";
      text += "　自分の話：相手の話＝3:7くらいを意識してみるとバランスが良いよ。\n";
    } else {
      text += "▶ ちょっと自己中心的に見えたり、ぶっきらぼうに見えている可能性があるかも。\n";
      text += "　相手の発言に対して『共感 → 一言自分の感想 → 質問』の3ステップを意識してみよう。\n";
    }

    text += "\n▶ 次に送ると良い例文のイメージ：\n";
    text += "　「さっきの話、◯◯ってところが面白いと思った！〇〇は普段どうしてるの？」\n";

    return text;
  }

  function showPremiumAdviceLockedModal() {
    const body =
      "この「特別アドバイス」は、広告視聴 or 課金で解放される想定のコンテンツです。\n\n" +
      "今は開発中なので、『広告を見たことにする』ボタンを押すと解放されます。";

    openModal(
      "💎 特別アドバイス（ロック中）",
      body,
      true,
      "広告を見たことにする",
      () => {
        premiumUnlocked = true;
        // 将来ここを「本物の広告 or 決済完了コールバック」に差し替える
      }
    );
  }

  function showPremiumAdviceModal() {
    if (!currentCharacterId) {
      openModal("特別アドバイス", "まずは誰かと話してみてね。");
      return;
    }

    const c = characters.find(x => x.id === currentCharacterId);
    const text = buildPremiumAdviceText();

    openModal(`💎 ${c.name} からの特別アドバイス`, text);
  }

  // ====== ステータス表示 ======
  function showStatusModal() {
    if (!currentCharacterId) {
      openModal("ステータス", "まずは誰かを選んで話しかけてみてね。");
      return;
    }

    const score = scores[currentCharacterId];
    const toSuccess = SUCCESS_SCORE - score;
    const toFail = score - FAIL_SCORE;
    const c = characters.find(x => x.id === currentCharacterId);

    let text =
      `【${c.name} との現在の状態】\n` +
      `スコア：${score} / ${SUCCESS_SCORE}\n\n`;

    if (gameEnded[currentCharacterId]) {
      if (score >= SUCCESS_SCORE) {
        text += "この子とはすでにゲーム成功済みです。おめでとう！\n";
      } else if (score <= FAIL_SCORE) {
        text += "この子とは一度ゲームオーバーになっています。\n\nもう一度リセットしてチャレンジしてみよう。";
      }
    } else {
      text += `成功まであと：${toSuccess > 0 ? toSuccess : 0}\n`;
      text += `ゲームオーバーまでの余裕：${toFail > 0 ? toFail : 0}\n`;
    }

    openModal("現在のステータス", text);
  }

  // ====== ゲームを手動終了（その時点で結果表示） ======
  function endCurrentGame() {
    if (!currentCharacterId) {
      openModal("ゲーム終了", "まずは誰かと話してからゲームを終了してね。");
      return;
    }

    const c = characters.find(x => x.id === currentCharacterId);
    const analysis = buildAnalysisText();
    const score = scores[currentCharacterId];

    let resultTitle = "途中結果";
    if (score >= SUCCESS_SCORE) resultTitle = "ゲーム成功（途中で終了）";
    else if (score <= FAIL_SCORE) resultTitle = "ゲームオーバー（途中で終了）";

    let text =
      `【${c.name} との現在のスコア】\n` +
      `スコア：${score} / ${SUCCESS_SCORE}\n\n` +
      `―― チャットのざっくり分析 ――\n` +
      analysis;

    const advice = lastAdvice[currentCharacterId];
    if (advice) {
      text += `\n―― ワンポイントアドバイス ――\n${advice}`;
    }

    gameEnded[currentCharacterId] = true;
    disableInput();

    openModal(
      resultTitle,
      text,
      true,
      "もう一度この子と話す",
      () => resetCharacterGame(currentCharacterId)
    );
  }

  // ====== ゲームリセット ======
  function resetCharacterGame(id) {
    histories[id] = [];
    scores[id] = INITIAL_SCORE;
    stages[id] = 1;
    gameEnded[id] = false;
    lastAdvice[id] = "";

    if (currentCharacterId === id) {
      currentScore = INITIAL_SCORE;
      currentStage = 1;
      enableInput();
      renderChat();
      showAdviceBar("");
    }
  }

  // ====== イベント設定 ======
  if (sendButtonEl) {
    sendButtonEl.onclick = handleSend;
  }

  if (messageInputEl) {
    messageInputEl.onkeydown = (e) => {
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
      showAdviceBar("");
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

  // 特別アドバイスボタン
  if (premiumAdviceButtonEl) {
    premiumAdviceButtonEl.onclick = () => {
      if (!premiumUnlocked) {
        showPremiumAdviceLockedModal();  // ロック中モーダル
      } else {
        showPremiumAdviceModal();        // 解放後のガチ総評
      }
    };
  }

  if (endGameButtonEl) {
    endGameButtonEl.onclick = endCurrentGame;
  }

  if (modalCloseButtonEl) {
    modalCloseButtonEl.onclick = closeModal;
  }

  if (modalOverlayEl) {
    modalOverlayEl.onclick = (e) => {
      if (e.target === modalOverlayEl) {
        closeModal();
      }
    };
  }

  // 画面幅変更（スマホ ←→ PC 切り替え時）
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
