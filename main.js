/* --------------------- */
/* ▼ キャラデータ ▼ */
/* --------------------- */
const characters = [
  { id: "lisa", name: "理沙", initials: "リ", desc: "26歳 / 広告代理店", headerSub: "カフェ好き女子" },
  { id: "miyu", name: "美優", initials: "ミ", desc: "25歳 / 保育士", headerSub: "ふわふわ系" },
  { id: "kana", name: "香奈", initials: "カ", desc: "27歳 / デザイナー", headerSub: "映画好き" }
];

// 各キャラごとの会話ログ
const histories = {};
characters.forEach(c => {
  histories[c.id] = [
    { from: c.id, text: `はじめまして、${c.name}です☺️` }
  ];
});

let currentCharacterId = null;

// 要素取得
const characterListEl = document.getElementById("characterList");
const chatBodyEl = document.getElementById("chatBody");
const chatHeaderNameEl = document.getElementById("chatHeaderName");
const chatHeaderSubEl = document.getElementById("chatHeaderSub");
const chatHeaderAvatarEl = document.getElementById("chatHeaderAvatar");
const messageInputEl = document.getElementById("messageInput");
const sendButtonEl = document.getElementById("sendButton");

/* --------------------- */
/* ▼ キャラ一覧生成 ▼ */
/* --------------------- */
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

/* --------------------- */
/* ▼ キャラを選択 ▼ */
/* --------------------- */
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
}

/* --------------------- */
/* ▼ チャット表示 ▼ */
/* --------------------- */
function renderChat() {
  chatBodyEl.innerHTML = "";
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

/* --------------------- */
/* ▼ 送信処理 ▼ */
/* --------------------- */
function handleSend() {
  const text = messageInputEl.value.trim();
  if (!text || !currentCharacterId) return;

  // 自分のメッセージを追加
  histories[currentCharacterId].push({ from: "me", text });

  // かなり簡単なダミー返信
  const c = characters.find(x => x.id === currentCharacterId);
  histories[currentCharacterId].push({
    from: c.id,
    text: `なるほど、${c.name}はそういうのも好きかも☺️`
  });

  messageInputEl.value = "";
  renderChat();
}

// イベント設定
sendButtonEl.onclick = handleSend;
messageInputEl.onkeydown = e => {
  if (e.key === "Enter") handleSend();
};

// 初期表示
renderCharacterList();

/* --------------------- */
/* ▼ スタート画面 ▼ */
/* --------------------- */
const startButtonEl = document.getElementById("startButton");
const startScreenEl = document.getElementById("startScreen");
const appEl = document.querySelector(".app");

startButtonEl.onclick = () => {
  startScreenEl.style.display = "none";
  appEl.classList.add("started");

  selectCharacter("lisa"); // 最初に理沙を開く
};
