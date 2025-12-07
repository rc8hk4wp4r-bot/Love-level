// あなたの Worker API の URL
const API_BASE = "https://lovelevel-api.rc8hk4wp4r.workers.dev";

// 理沙にメッセージを送る関数
async function sendToLisa(userMessage) {
  const res = await fetch(`${API_BASE}/api/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userMessage }),
  });

  if (!res.ok) {
    console.error("API Error:", res.status);
    throw new Error("API error");
  }

  return await res.json(); // { lisaMessage, score, stage }
}

// HTML 上でチャットを操作する部分
function addMyMessage(text) {
  const area = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message me";
  div.textContent = text;
  area.appendChild(div);
}

function addLisaMessage(text) {
  const area = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message lisa";
  div.textContent = text;
  area.appendChild(div);
}

async function handleSend() {
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text) return;

  // 自分のメッセージ
  addMyMessage(text);
  input.value = "";

  try {
    const data = await sendToLisa(text);
    addLisaMessage(data.lisaMessage);
  } catch (e) {
    addLisaMessage("エラーが出たみたい…もう一回送ってみてね！");
  }
}
