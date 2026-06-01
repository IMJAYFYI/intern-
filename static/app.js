const messagesEl = document.querySelector("#messages");
const statusEl = document.querySelector("#status");
const textForm = document.querySelector("#textForm");
const messageInput = document.querySelector("#messageInput");
const sendBtn = document.querySelector("#sendBtn");
const recordBtn = document.querySelector("#recordBtn");
const recordLabel = document.querySelector("#recordLabel");
const clearBtn = document.querySelector("#clearBtn");
const replyAudio = document.querySelector("#replyAudio");
const chatTab = document.querySelector("#chatTab");
const ragTab = document.querySelector("#ragTab");
const chatView = document.querySelector("#chatView");
const ragView = document.querySelector("#ragView");
const uploadForm = document.querySelector("#uploadForm");
const pdfInput = document.querySelector("#pdfInput");
const fileName = document.querySelector("#fileName");
const fileHint = document.querySelector("#fileHint");
const uploadBtn = document.querySelector("#uploadBtn");
const ragFile = document.querySelector("#ragFile");
const ragPages = document.querySelector("#ragPages");
const ragChunks = document.querySelector("#ragChunks");
const clearRagBtn = document.querySelector("#clearRagBtn");
const ragStatusEl = document.querySelector("#ragStatus");
const ragMessagesEl = document.querySelector("#ragMessages");
const ragQueryForm = document.querySelector("#ragQueryForm");
const ragQuestion = document.querySelector("#ragQuestion");
const ragAskBtn = document.querySelector("#ragAskBtn");
const sourcesList = document.querySelector("#sourcesList");
const sourcesCount = document.querySelector("#sourcesCount");
const API_BASE_URL = "https://intern-8nvs.onrender.com";

let recorder = null;
let chunks = [];
let isBusy = false;
let isRagBusy = false;
let ragLoaded = false;

function switchView(nextView) {
  const showRag = nextView === "rag";
  chatView.hidden = showRag;
  ragView.hidden = !showRag;
  chatView.classList.toggle("active", !showRag);
  ragView.classList.toggle("active", showRag);
  chatTab.classList.toggle("active", !showRag);
  ragTab.classList.toggle("active", showRag);
  chatTab.setAttribute("aria-selected", String(!showRag));
  ragTab.setAttribute("aria-selected", String(showRag));

  if (showRag) {
    ragQuestion.focus();
  } else {
    messageInput.focus();
  }
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

function setBusy(nextBusy) {
  isBusy = nextBusy;
  sendBtn.disabled = nextBusy;
  messageInput.disabled = nextBusy;
  clearBtn.disabled = nextBusy;
}

function addMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  appendStructuredText(bubble, text, role);

  article.appendChild(bubble);
  messagesEl.appendChild(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addLoadingMessage(container) {
  const article = document.createElement("article");
  article.className = "message assistant loading";
  article.setAttribute("aria-label", "AI is generating a response");

  const bubble = document.createElement("div");
  bubble.className = "bubble loading-bubble";

  const spinner = document.createElement("span");
  spinner.className = "loading-spinner";
  spinner.setAttribute("aria-hidden", "true");

  bubble.appendChild(spinner);
  article.appendChild(bubble);
  container.appendChild(article);
  container.scrollTop = container.scrollHeight;

  return article;
}

function removeLoadingMessage(loadingMessage) {
  if (loadingMessage) {
    loadingMessage.remove();
  }
}

function showError(error) {
  const detail = error?.detail || error?.message || "Something went wrong.";
  setStatus(detail);
}

function showRagError(error) {
  const detail = error?.detail || error?.message || "Something went wrong.";
  setRagStatus(detail);
}

function setRagStatus(message) {
  ragStatusEl.textContent = message || "";
}

function setRagBusy(nextBusy) {
  isRagBusy = nextBusy;
  uploadBtn.disabled = nextBusy;
  clearRagBtn.disabled = nextBusy;
  ragQuestion.disabled = nextBusy || !ragLoaded;
  ragAskBtn.disabled = nextBusy || !ragLoaded;
}

function addRagMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  appendStructuredText(bubble, text, role);

  article.appendChild(bubble);
  ragMessagesEl.appendChild(article);
  ragMessagesEl.scrollTop = ragMessagesEl.scrollHeight;
}

function appendStructuredText(container, text, role) {
  if (role === "user") {
    container.textContent = text;
    return;
  }

  const lines = String(text || "").split(/\r?\n/);
  let list = null;

  function closeList() {
    list = null;
  }

  function appendParagraph(value) {
    closeList();
    const paragraph = document.createElement("p");
    paragraph.textContent = value;
    container.appendChild(paragraph);
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    const headingText = line.replace(/\*\*/g, "");
    if (/^[A-Za-z][A-Za-z0-9 ]{1,40}:$/.test(headingText)) {
      closeList();
      const heading = document.createElement("h3");
      heading.textContent = headingText;
      container.appendChild(heading);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    if (bulletMatch || numberedMatch) {
      if (!list) {
        list = document.createElement(numberedMatch ? "ol" : "ul");
        container.appendChild(list);
      }

      const item = document.createElement("li");
      item.textContent = bulletMatch ? bulletMatch[1] : numberedMatch[1];
      list.appendChild(item);
      continue;
    }

    appendParagraph(line);
  }

  if (!container.childElementCount) {
    container.textContent = text;
  }
}

async function postJson(url, body) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw data;
  }

  return data;
}

async function getJson(url) {
  const response = await fetch(`${API_BASE_URL}${url}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw data;
  }

  return data;
}

function renderRagState(state) {
  ragLoaded = Boolean(state.is_loaded);
  ragFile.textContent = state.filename || "No PDF loaded";
  ragPages.textContent = state.total_pages || 0;
  ragChunks.textContent = state.total_chunks || 0;
  ragQuestion.placeholder = ragLoaded ? "Ask a question about the PDF..." : "Upload a PDF before asking...";
  setRagBusy(isRagBusy);
}

function renderSources(sources = []) {
  sourcesList.innerHTML = "";
  sourcesCount.textContent = `${sources.length} ${sources.length === 1 ? "chunk" : "chunks"}`;

  if (!sources.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No source chunks returned.";
    sourcesList.appendChild(empty);
    return;
  }

  sources.forEach((source) => {
    const details = document.createElement("details");
    details.className = "source-item";

    const summary = document.createElement("summary");
    summary.textContent = `Chunk ${source.chunk_id} - Page ${source.page}`;

    const content = document.createElement("p");
    content.textContent = source.content;

    details.append(summary, content);
    sourcesList.appendChild(details);
  });
}

async function refreshRagStatus() {
  try {
    const state = await getJson("/rag/status");
    renderRagState(state);
  } catch (error) {
    showRagError(error);
  }
}

async function sendText(message) {
  setBusy(true);
  setStatus("Thinking...");
  addMessage("user", message);
  const loadingMessage = addLoadingMessage(messagesEl);

  try {
    const data = await postJson("/chat", { message });
    removeLoadingMessage(loadingMessage);
    addMessage("assistant", data.response);
    setStatus("");
  } catch (error) {
    removeLoadingMessage(loadingMessage);
    showError(error);
  } finally {
    setBusy(false);
    messageInput.focus();
  }
}

textForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message || isBusy) {
    return;
  }

  messageInput.value = "";
  messageInput.style.height = "auto";
  sendText(message);
});

chatTab.addEventListener("click", () => switchView("chat"));
ragTab.addEventListener("click", () => {
  switchView("rag");
  refreshRagStatus();
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${messageInput.scrollHeight}px`;
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    textForm.requestSubmit();
  }
});

clearBtn.addEventListener("click", async () => {
  setBusy(true);
  setStatus("Clearing...");

  try {
    await postJson("/chat/clear", {});
    messagesEl.innerHTML = "";
    addMessage("assistant", "Chat history cleared.");
    replyAudio.removeAttribute("src");
    setStatus("");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
});

pdfInput.addEventListener("change", () => {
  const file = pdfInput.files?.[0];
  fileName.textContent = file ? file.name : "Choose a PDF";
  fileHint.textContent = file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "No file selected";
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = pdfInput.files?.[0];

  if (!file) {
    setRagStatus("Choose a PDF before uploading.");
    return;
  }

  setRagBusy(true);
  setRagStatus("Uploading and indexing PDF...");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/rag/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw data;
    }

    renderRagState({ ...data, is_loaded: true });
    ragMessagesEl.innerHTML = "";
    addRagMessage("assistant", `Indexed ${data.filename}. Ready for document questions.`);
    renderSources([]);
    setRagStatus(data.message || "PDF indexed.");
    ragQuestion.focus();
  } catch (error) {
    showRagError(error);
  } finally {
    setRagBusy(false);
  }
});

ragQueryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = ragQuestion.value.trim();

  if (!question || isRagBusy || !ragLoaded) {
    return;
  }

  ragQuestion.value = "";
  ragQuestion.style.height = "auto";
  setRagBusy(true);
  setRagStatus("Thinking...");
  addRagMessage("user", question);
  const loadingMessage = addLoadingMessage(ragMessagesEl);

  try {
    const data = await postJson("/rag/query", { question });
    removeLoadingMessage(loadingMessage);
    addRagMessage("assistant", data.answer);
    renderSources(data.sources || []);
    setRagStatus("");
  } catch (error) {
    removeLoadingMessage(loadingMessage);
    showRagError(error);
  } finally {
    setRagBusy(false);
    ragQuestion.focus();
  }
});

ragQuestion.addEventListener("input", () => {
  ragQuestion.style.height = "auto";
  ragQuestion.style.height = `${ragQuestion.scrollHeight}px`;
});

ragQuestion.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    ragQueryForm.requestSubmit();
  }
});

clearRagBtn.addEventListener("click", async () => {
  setRagBusy(true);
  setRagStatus("Clearing PDF index...");

  try {
    const data = await postJson("/rag/clear", {});
    renderRagState({ is_loaded: false, filename: null, total_pages: 0, total_chunks: 0 });
    ragMessagesEl.innerHTML = "";
    addRagMessage("assistant", "PDF index cleared. Upload a PDF to start again.");
    renderSources([]);
    pdfInput.value = "";
    fileName.textContent = "Choose a PDF";
    fileHint.textContent = "No file selected";
    setRagStatus(data.message || "PDF index cleared.");
  } catch (error) {
    showRagError(error);
  } finally {
    setRagBusy(false);
  }
});

recordBtn.addEventListener("click", async () => {
  if (recorder && recorder.state === "recording") {
    recorder.stop();
    return;
  }

  if (isBusy) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream);

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((track) => track.stop());
      recordBtn.classList.remove("recording");
      recordLabel.textContent = "Start voice";
      await sendRecording();
    });

    recordBtn.classList.add("recording");
    recordLabel.textContent = "Stop voice";
    setStatus("Recording...");
    recorder.start();
  } catch (error) {
    setStatus("Microphone permission is needed to send voice input.");
  }
});

async function sendRecording() {
  if (!chunks.length) {
    setStatus("");
    return;
  }

  let loadingMessage = null;
  setBusy(true);
  setStatus("Preparing audio...");

  try {
    const inputBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    const wavBlob = await convertBlobToWav(inputBlob);
    const formData = new FormData();
    formData.append("file", wavBlob, "voice.wav");

    setStatus("Transcribing and thinking...");
    loadingMessage = addLoadingMessage(messagesEl);
    const response = await fetch(`${API_BASE_URL}/chat/voice`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw data;
    }

    removeLoadingMessage(loadingMessage);
    addMessage("user", data.user_text || "Voice message");
    addMessage("assistant", data.response);

    if (data.audio) {
      replyAudio.src = data.audio;
      replyAudio.play().catch(() => {});
    }

    setStatus("");
  } catch (error) {
    removeLoadingMessage(loadingMessage);
    showError(error);
  } finally {
    setBusy(false);
    chunks = [];
  }
}

async function convertBlobToWav(blob) {
  const audioContext = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const wavBuffer = encodeWav(audioBuffer);
  await audioContext.close();
  return new Blob([wavBuffer], { type: "audio/wav" });
}

function encodeWav(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = interleaveChannels(audioBuffer);
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function interleaveChannels(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  if (channels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const result = new Float32Array(length * channels);
  for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      result[sampleIndex * channels + channel] = audioBuffer.getChannelData(channel)[sampleIndex];
    }
  }

  return result;
}

function writeString(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

refreshRagStatus();
