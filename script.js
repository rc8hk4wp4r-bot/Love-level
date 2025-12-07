// ====== 設定：Worker API の URL ======
const API_BASE = "https://lovelevel-api.rc8hk4wp4r.workers.dev";

// ====== キャラデータ（フロント用表示） ======
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

let currentCharacterId = null;

// DOM 要素取得
const appEl = document.getElementById("appRoot");
const characterListEl = document.getElementById("characterList");
const chatBodyEl = document.getElementById("chatBody");
const chatHeaderNameEl = document.getElementById("chatHeaderName");
const chatHeaderSubEl = document.getElementById("chatHeaderSub");
const chatHeaderAvatarEl = document.getElementById("chatHeaderAvatar");
const messageInputEl = document.getElementById("messageInput");
const sendButtonEl = document.getElementById("sendButton");
const backButtonEl = document.getElementById("backButton");

// ====== API 呼び出し：キャラIDも一緒に送る ======
async function sendToCharacter(characterId, userMessage) {
  const res = await fetch(`${API_BASE}/api/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId, userMessage }),
  });

  if (!res.ok) {
    console.error("API Error:", res.status);
    throw new Error("API error");
  }

  // { lisaMessage, score, stage } が返ってくる
  return await res.json();
}

// ====== UI 描画系 ======
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

  // まだ誰も選ばれていないときは案内カードだけ表示
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

  chatHeaderAvatarEl.innerHTML = `<span>${c.initials}</span>`;
  chatHeaderNameEl.textContent = c.name;
  chatHeaderSubEl.textContent = c.headerSub;

  messageInputEl.disabled = false;
  sendButtonEl.disabled = false;

  renderCharacterList();
  renderChat();

  // スマホならチャット画面に切り替え
  if (window.innerWidth <= 768) {
    appEl.classList.add("show-chat");
  }
}

// ====== 送信処理（キャラID付きでAPIに投げる） ======
async function handleSend() {
  const text = messageInputEl.value.trim();
  if (!text || !currentCharacterId) return;

  // 自分のメッセージを履歴に追加
  histories[currentCharacterId].push({ from: "me", text });
  messageInputEl.value = "";
  renderChat();

  try {
    const data = await sendToCharacter(currentCharacterId, text);

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

// ====== イベント設定 ======
sendButtonEl.onclick = handleSend;

messageInputEl.onkeydown = e => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleSend();
  }
};

backButtonEl.onclick = () => {
  appEl.classList.remove("show-chat");
  currentCharacterId = null;

  chatHeaderAvatarEl.innerHTML = "<span>？</span>";
  chatHeaderNameEl.textContent = "相手を選んでください";
  chatHeaderSubEl.textContent = "リストから選ぶと開始します";

  messageInputEl.value = "";
  messageInputEl.disabled = true;
  sendButtonEl.disabled = true;

  renderCharacterList();
  renderChat();
};

window.addEventListener("resize", () => {
  if (window.innerWidth > 768) {
    appEl.classList.remove("show-chat");
  }
});

// ====== 初期表示 ======
renderCharacterList();
renderChat();
