const textInput = document.querySelector("#textInput");
const historyList = document.querySelector("#historyList");
const historyCount = document.querySelector("#historyCount");
const saveHistoryButton = document.querySelector("#saveHistoryButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const lineList = document.querySelector("#lineList");
const lineCount = document.querySelector("#lineCount");
const voiceSelect = document.querySelector("#voiceSelect");
const voiceTestButton = document.querySelector("#voiceTestButton");
const voiceRefreshButton = document.querySelector("#voiceRefreshButton");
const speed = document.querySelector("#speed");
const speedValue = document.querySelector("#speedValue");
const statusText = document.querySelector("#status");
const playButton = document.querySelector("#playButton");
const pauseButton = document.querySelector("#pauseButton");
const resumeButton = document.querySelector("#resumeButton");
const stopButton = document.querySelector("#stopButton");

let voices = [];
let lines = [];
let currentUtterance = null;
let activeLineIndex = null;
let playQueue = [];
let queuePosition = 0;
let playbackToken = 0;

const preferredVoiceKey = "englishReaderPreferredVoice";
const historyKey = "englishReaderTextHistory";
const maxHistoryItems = 30;
const nativeLikeNames = [
  "alex",
  "allison",
  "aria",
  "ava",
  "daniel",
  "guy",
  "jenny",
  "karen",
  "libby",
  "moira",
  "samantha",
  "siri",
  "sonia",
  "susan",
  "tessa",
  "tom",
  "zira",
];

function setStatus(message, isWarning = false) {
  statusText.textContent = message;
  statusText.classList.toggle("warning", isWarning);
}

function updateSpeedLabel() {
  speedValue.value = `${Number(speed.value).toFixed(2).replace(/0$/, "").replace(/\.0$/, ".0")}x`;
}

function getLineIndexes() {
  return lines
    .map((line, index) => (line.trim() ? index : null))
    .filter((index) => index !== null);
}

function renderLines() {
  const previousActive = activeLineIndex;
  lines = textInput.value.replace(/\r\n/g, "\n").split("\n");
  const readableCount = getLineIndexes().length;

  lineCount.textContent = `${readableCount}行`;
  lineList.innerHTML = "";

  if (readableCount === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-lines";
    empty.textContent = "テキストを貼り付けると、ここに行ごとに表示されます。";
    lineList.append(empty);
    return;
  }

  lines.forEach((line, index) => {
    const item = document.createElement("button");
    const number = document.createElement("span");
    const text = document.createElement("span");

    item.type = "button";
    item.className = "line-item";
    item.dataset.index = String(index);
    item.disabled = !line.trim();
    item.setAttribute("aria-label", `${index + 1}行目を読み上げ`);

    if (index === previousActive) {
      item.classList.add("is-current");
    }

    number.className = "line-number";
    number.textContent = String(index + 1).padStart(2, "0");
    text.className = "line-text";
    text.textContent = line.trim() ? line : "空行";

    item.append(number, text);
    lineList.append(item);
  });
}

function setActiveLine(index) {
  activeLineIndex = index;
  document.querySelectorAll(".line-item").forEach((item) => {
    item.classList.toggle("is-current", Number(item.dataset.index) === index);
  });

  const activeItem = document.querySelector(`.line-item[data-index="${index}"]`);
  if (activeItem) {
    activeItem.scrollIntoView({ block: "nearest" });
  }
}

function getSelectedVoice() {
  return voices.find((voice) => voice.name === voiceSelect.value) || null;
}

function getSavedVoiceName() {
  try {
    return localStorage.getItem(preferredVoiceKey);
  } catch {
    return null;
  }
}

function saveVoiceName(name) {
  try {
    localStorage.setItem(preferredVoiceKey, name);
  } catch {
    // Some mobile browsers restrict storage in private tabs.
  }
}

function getHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(historyKey, JSON.stringify(history));
    return true;
  } catch {
    setStatus("履歴を保存できませんでした。Safariのプライベートブラウズでは保存できない場合があります。", true);
    return false;
  }
}

function getHistoryTitle(text) {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ? firstLine.slice(0, 90) : "Untitled text";
}

function formatHistoryDate(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function renderHistory() {
  const history = getHistory();
  historyCount.textContent = `${history.length}件`;
  historyList.innerHTML = "";

  if (history.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-lines";
    empty.textContent = "保存した英文がここに表示されます。";
    historyList.append(empty);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("div");
    const loadButton = document.createElement("button");
    const title = document.createElement("span");
    const meta = document.createElement("span");
    const deleteButton = document.createElement("button");
    const lineTotal = entry.text.split("\n").filter((line) => line.trim()).length;

    item.className = "history-item";
    loadButton.type = "button";
    loadButton.className = "history-load";
    loadButton.dataset.id = entry.id;
    title.className = "history-title";
    title.textContent = entry.title;
    meta.className = "history-meta";
    meta.textContent = `${formatHistoryDate(entry.updatedAt)} / ${lineTotal}行`;
    deleteButton.type = "button";
    deleteButton.className = "history-delete";
    deleteButton.dataset.id = entry.id;
    deleteButton.setAttribute("aria-label", "履歴を削除");
    deleteButton.textContent = "×";

    loadButton.append(title, meta);
    item.append(loadButton, deleteButton);
    historyList.append(item);
  });
}

function addCurrentTextToHistory(source = "manual") {
  const text = textInput.value.trim();

  if (!text) {
    setStatus("保存する英文を貼り付けてください。", true);
    textInput.focus();
    return;
  }

  const now = Date.now();
  const history = getHistory();
  const existingIndex = history.findIndex((entry) => entry.text === text);
  const entry = {
    id: existingIndex >= 0 ? history[existingIndex].id : String(now),
    title: getHistoryTitle(text),
    text,
    createdAt: existingIndex >= 0 ? history[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    history.splice(existingIndex, 1);
  }

  history.unshift(entry);
  const saved = saveHistory(history.slice(0, maxHistoryItems));

  if (saved) {
    renderHistory();
    setStatus(source === "paste" ? "貼り付けた英文を履歴に保存しました。" : "英文を履歴に保存しました。");
  }
}

function loadHistoryEntry(id) {
  const entry = getHistory().find((item) => item.id === id);

  if (!entry) {
    setStatus("履歴が見つかりませんでした。", true);
    return;
  }

  stopSpeech();
  textInput.value = entry.text;
  renderLines();
  setStatus("履歴から英文を読み込みました。");
  textInput.scrollIntoView({ block: "start" });
}

function deleteHistoryEntry(id) {
  const nextHistory = getHistory().filter((entry) => entry.id !== id);

  if (saveHistory(nextHistory)) {
    renderHistory();
    setStatus("履歴を削除しました。");
  }
}

function scoreVoice(voice) {
  const name = voice.name.toLowerCase();
  const uri = voice.voiceURI.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang === "en-us") score += 60;
  else if (lang === "en-gb") score += 54;
  else if (lang === "en-au") score += 48;
  else if (lang === "en-ca") score += 44;
  else if (lang.startsWith("en")) score += 36;
  else score -= 80;

  if (/premium|enhanced|natural|neural|eloquence/.test(`${name} ${uri}`)) score += 36;
  if (/compact/.test(`${name} ${uri}`)) score -= 24;
  if (voice.localService) score += 10;
  if (/apple|siri/.test(`${name} ${uri}`)) score += 18;
  if (/google|microsoft/.test(name)) score += 8;
  if (nativeLikeNames.some((keyword) => name.includes(keyword))) score += 12;
  if (voice.default) score += 4;

  return score;
}

function getVoiceLabel(voice, isRecommended) {
  const parts = [];
  const searchable = `${voice.name} ${voice.voiceURI}`.toLowerCase();

  if (isRecommended) {
    parts.push("おすすめ");
  }

  if (/premium|enhanced|natural|neural|eloquence/.test(searchable)) {
    parts.push("高品質候補");
  }

  if (voice.localService) {
    parts.push("端末内");
  }

  const prefix = parts.length ? `${parts.join(" / ")}: ` : "";
  return `${prefix}${voice.name} (${voice.lang})`;
}

function buildUtterance(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  const selectedVoice = getSelectedVoice();

  utterance.rate = Number(speed.value);
  utterance.lang = selectedVoice?.lang || "en-US";

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  return utterance;
}

function stopSpeech(clearHighlight = true) {
  playbackToken += 1;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  currentUtterance = null;
  playQueue = [];
  queuePosition = 0;

  if (clearHighlight) {
    setActiveLine(null);
  }
}

function speakQueue(indexes, initialMessage) {
  if (!("speechSynthesis" in window)) {
    setStatus("このブラウザは読み上げ機能に対応していません。", true);
    return;
  }

  if (indexes.length === 0) {
    setStatus("読み上げるテキストを貼り付けてください。", true);
    textInput.focus();
    return;
  }

  stopSpeech(false);
  playbackToken += 1;
  playQueue = indexes;
  queuePosition = 0;
  setStatus(initialMessage);
  speakNext(playbackToken);
}

function speakNext(token) {
  if (token !== playbackToken || queuePosition >= playQueue.length) {
    currentUtterance = null;
    setActiveLine(null);
    setStatus("再生が完了しました。");
    return;
  }

  const lineIndex = playQueue[queuePosition];
  const line = lines[lineIndex]?.trim();

  if (!line) {
    queuePosition += 1;
    speakNext(token);
    return;
  }

  setActiveLine(lineIndex);
  currentUtterance = buildUtterance(line);
  currentUtterance.onstart = () => setStatus(`${lineIndex + 1}行目を再生中: ${speedValue.value}`);
  currentUtterance.onend = () => {
    if (token !== playbackToken) {
      return;
    }

    queuePosition += 1;
    speakNext(token);
  };
  currentUtterance.onerror = () => {
    if (token === playbackToken) {
      currentUtterance = null;
      setStatus("読み上げ中にエラーが発生しました。", true);
    }
  };

  window.speechSynthesis.speak(currentUtterance);
}

function playAllLines() {
  renderLines();
  speakQueue(getLineIndexes(), "全文を行ごとに再生します。");
}

function playSingleLine(index) {
  renderLines();
  speakQueue([index], `${index + 1}行目だけ再生します。`);
}

function populateVoices() {
  if (!("speechSynthesis" in window)) {
    voiceSelect.innerHTML = '<option value="">このブラウザでは選択できません</option>';
    return;
  }

  voices = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = "";

  if (voices.length === 0) {
    voiceSelect.innerHTML = '<option value="">音声を読み込み中...</option>';
    return;
  }

  const savedVoiceName = getSavedVoiceName();
  const sortedVoices = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  const recommendedVoices = sortedVoices.filter((voice) => scoreVoice(voice) >= 48).slice(0, 3);

  sortedVoices.forEach((voice) => {
    const option = document.createElement("option");
    const isRecommended = recommendedVoices.includes(voice);

    option.value = voice.name;
    option.textContent = getVoiceLabel(voice, isRecommended);
    voiceSelect.append(option);
  });

  const savedVoice = voices.find((voice) => voice.name === savedVoiceName);
  const defaultVoice = savedVoice || sortedVoices[0];
  voiceSelect.value = defaultVoice.name;
  setStatus(`声: ${defaultVoice.name} (${defaultVoice.lang})`);
}

function refreshVoices() {
  if (!("speechSynthesis" in window)) {
    setStatus("このブラウザは読み上げ機能に対応していません。", true);
    return;
  }

  window.speechSynthesis.cancel();
  populateVoices();
  setTimeout(populateVoices, 250);
  setTimeout(populateVoices, 1000);
}

textInput.addEventListener("input", () => {
  renderLines();
  if (!window.speechSynthesis?.speaking) {
    setActiveLine(null);
  }
});

textInput.addEventListener("paste", () => {
  setTimeout(() => addCurrentTextToHistory("paste"), 0);
});

historyList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".history-delete");
  const loadButton = event.target.closest(".history-load");

  if (deleteButton) {
    deleteHistoryEntry(deleteButton.dataset.id);
    return;
  }

  if (loadButton) {
    loadHistoryEntry(loadButton.dataset.id);
  }
});

saveHistoryButton.addEventListener("click", () => addCurrentTextToHistory());

clearHistoryButton.addEventListener("click", () => {
  if (saveHistory([])) {
    renderHistory();
    setStatus("履歴をすべて削除しました。");
  }
});

lineList.addEventListener("click", (event) => {
  const item = event.target.closest(".line-item");
  if (!item || item.disabled) {
    return;
  }

  playSingleLine(Number(item.dataset.index));
});

speed.addEventListener("input", () => {
  updateSpeedLabel();

  if (window.speechSynthesis?.speaking && activeLineIndex !== null) {
    const remainingQueue = playQueue.slice(queuePosition);
    speakQueue(remainingQueue, `速度を ${speedValue.value} に変更しました。`);
  }
});

voiceSelect.addEventListener("change", () => {
  saveVoiceName(voiceSelect.value);

  if (window.speechSynthesis?.speaking && activeLineIndex !== null) {
    const remainingQueue = playQueue.slice(queuePosition);
    speakQueue(remainingQueue, "声を変更しました。");
  } else {
    const selectedVoice = getSelectedVoice();
    setStatus(selectedVoice ? `声: ${selectedVoice.name} (${selectedVoice.lang})` : "声を変更しました。");
  }
});

voiceTestButton.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    setStatus("このブラウザは読み上げ機能に対応していません。", true);
    return;
  }

  stopSpeech();
  currentUtterance = buildUtterance("Hello, this is a sample of the selected English voice.");
  currentUtterance.onstart = () => setStatus("選択中の声を試聴しています。");
  currentUtterance.onend = () => {
    currentUtterance = null;
    setStatus("試聴が完了しました。");
  };
  currentUtterance.onerror = () => setStatus("試聴中にエラーが発生しました。", true);
  window.speechSynthesis.speak(currentUtterance);
});

voiceRefreshButton.addEventListener("click", () => {
  refreshVoices();
  setStatus("iPhoneの音声一覧を再取得しています。");
});

playButton.addEventListener("click", playAllLines);

pauseButton.addEventListener("click", () => {
  if (window.speechSynthesis?.speaking) {
    window.speechSynthesis.pause();
    setStatus("一時停止中です。");
  }
});

resumeButton.addEventListener("click", () => {
  if (window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
    setStatus(`再生中: ${speedValue.value}`);
  }
});

stopButton.addEventListener("click", () => {
  stopSpeech();
  setStatus("停止しました。");
});

window.addEventListener("beforeunload", () => stopSpeech());
window.speechSynthesis?.addEventListener?.("voiceschanged", populateVoices);
window.addEventListener("pageshow", refreshVoices);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshVoices();
  }
});

updateSpeedLabel();
renderLines();
renderHistory();
populateVoices();
