import { useEffect, useRef, useState } from 'react';
import ChatBubble from '../components/ChatBubble.jsx';
import { FilesAPI } from '../lib/api'; // uses your API layer
import '../css/pages/builder.css';

const makeMsg = (from, text) => ({
  id: crypto.randomUUID(),
  from,
  text,
  ts: Date.now(),
});

export default function Builder() {
  // --- state ---
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState([
    makeMsg('bot', 'Hi! I can help plan your courses.'),
  ]);

  // --- refs ---
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- effects ---
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('selectedCourses');
      if (!raw) return;
      localStorage.removeItem('selectedCourses');
      const picked = JSON.parse(raw);
      if (Array.isArray(picked) && picked.length) {
        const list = picked.map((c) => c.code || c.name || c.id).join(', ');
        addBot(`I see you selected: ${list}`);
      }
    } catch { /* ignore */ }
  }, []);

  // --- helpers ---
  function addYou(t) { setMessages((m) => [...m, makeMsg('you', t)]); }
  function addBot(t) { setMessages((m) => [...m, makeMsg('bot', t)]); }
  const canSend = text.trim().length > 0 && !sending && !uploading;

  // mock reply for now
  async function fakeReply(userText) {
    setSending(true);
    await new Promise((r) => setTimeout(r, 300));
    addBot('Got it! (mock reply)');
    setSending(false);
  }

  // --- text events ---
  function onChange(e) { setText(e.target.value); }
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
  async function handleSubmit() {
    const value = text.trim();
    if (!value || sending || uploading) return;
    addYou(value);
    setText('');
    await fakeReply(value);
    // later: const { reply } = await ChatAPI.send(value); addBot(reply);
  }

  // --- file upload events ---
  function openFilePicker() {
    if (sending || uploading) return;
    fileInputRef.current?.click();
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    // allow selecting the same file again later
    e.target.value = '';

    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      addBot('⚠️ Please select a PDF file.');
      return;
    }
    const MAX_MB = 20;
    if (file.size > MAX_MB * 1024 * 1024) {
      addBot(`⚠️ File is too large. Max ${MAX_MB} MB.`);
      return;
    }

    setUploading(true);
    const uploadingId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: uploadingId, from: 'bot', text: `Uploading “${file.name}”…`, ts: Date.now() },
    ]);

    try {
      await FilesAPI.uploadPdf(file); // FastAPI should accept field "file"
      setMessages((m) =>
        m.map((msg) =>
          msg.id === uploadingId ? { ...msg, text: `✔️ Uploaded: ${file.name}` } : msg
        )
      );
    } catch (err) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === uploadingId
            ? { ...msg, text: `❌ Upload failed: ${err.message || 'Failed to fetch'}` }
            : msg
        )
      );
    } finally {
      setUploading(false);
    }
  }

  // --- render ---
  return (
    <section className="main builder">
      <div className="chat" ref={listRef}>
        <div className="chat-inner">
          {messages.map((m) => (
            <ChatBubble key={m.id} from={m.from}>
              {m.text}
            </ChatBubble>
          ))}
          {sending && <ChatBubble from="bot">CB is typing…</ChatBubble>}
        </div>
      </div>

      <form className="input-bar" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {/* hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={onPickFile}
          hidden
        />

        {/* docked attach button + textarea */}
        <div className="input-group">
          <button
            type="button"
            className="attach-btn"
            onClick={openFilePicker}
            disabled={sending || uploading}
            title="Attach PDF"
          >
            📎 PDF
          </button>

          <textarea
            className="textbox"
            placeholder="Message…"
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            rows={1}
            autoFocus
          />
        </div>

        <button className="btn" type="submit" disabled={!canSend}>
          Send
        </button>
      </form>
    </section>
  );
}
