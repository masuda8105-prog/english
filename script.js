const textInput = document.querySelector("#textInput");
const lineList = document.querySelector("#lineList");
const lineCount = document.querySelector("#lineCount");
const voiceSelect = document.querySelector("#voiceSelect");
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

  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const sortedVoices = [...englishVoices, ...voices.filter((voice) => !voice.lang.toLowerCase().startsWith("en"))];

  sortedVoices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.append(option);
  });

  const defaultVoice = englishVoices.find((voice) => voice.default) || englishVoices[0] || voices[0];
  voiceSelect.value = defaultVoice.name;
}

textInput.addEventListener("input", () => {
  renderLines();
  if (!window.speechSynthesis?.speaking) {
    setActiveLine(null);
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

  if (window.speechSynthesis.speaking && activeLineIndex !== null) {
    const remainingQueue = playQueue.slice(queuePosition);
    speakQueue(remainingQueue, `速度を ${speedValue.value} に変更しました。`);
  }
});

voiceSelect.addEventListener("change", () => {
  if (window.speechSynthesis.speaking && activeLineIndex !== null) {
    const remainingQueue = playQueue.slice(queuePosition);
    speakQueue(remainingQueue, "声を変更しました。");
  }
});

playButton.addEventListener("click", playAllLines);

pauseButton.addEventListener("click", () => {
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    setStatus("一時停止中です。");
  }
});

resumeButton.addEventListener("click", () => {
  if (window.speechSynthesis.paused) {
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

updateSpeedLabel();
renderLines();
populateVoices();
