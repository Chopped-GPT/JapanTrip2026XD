// src/pages/Builder.jsx
import { useEffect, useRef, useState } from 'react';
import ChatBubble from '../components/ChatBubble.jsx';
import { FilesAPI } from '../lib/api'; // still used for the PDF button (mock-safe)
import '../css/pages/builder.css';

const makeMsg = (from, text) => ({
  id: crypto.randomUUID(),
  from,
  text,
  ts: Date.now(),
});

// --- demo schedule helper ----------------------------------------------------
function makeDemoSchedule() {
  const swapped = localStorage.getItem('swap3340') === '1'; // set when user says "switch 3340"
  const automata = swapped
    ? { code: 'COSC 3320', title: 'Algorithms & Data Structures II', time: 'Afternoon' }
    : { code: 'COSC 3340', title: 'Intro to Automata & Computability', time: 'Afternoon' };

  const week = {
    Mon: [{ code: 'COSC 3360', title: 'Database Systems', time: 'Morning' }],
    Tue: [{ code: 'COSC 4351', title: 'Fund. Of Software Engineering', time: 'Morning' }],
    Wed: [automata],
    Thu: [],
    Fri: [],
  };

  return {
    note: 'Mock schedule generated locally (frontend-only demo).',
    week,
    chatSessionId: null,
    pdfIds: [],
  };
}

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
    // If CourseList stashed a selection in localStorage, acknowledge it
    try {
      const raw = localStorage.getItem('selectedCourses');
      if (!raw) return;
      localStorage.removeItem('selectedCourses');
      const picked = JSON.parse(raw);
      if (Array.isArray(picked) && picked.length) {
        const list = picked.map((c) => c.code || c.name || c.id).join(', ');
        addBot(`I see you selected: ${list}`);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // --- helpers ---
  function addYou(t) {
    setMessages((m) => [...m, makeMsg('you', t)]);
  }
  function addBot(t) {
    setMessages((m) => [...m, makeMsg('bot', t)]);
  }
  const canSend = text.trim().length > 0 && !sending && !uploading;

  // --- scripted mock reply (matches your demo script) ------------------------
  async function fakeReply(userText) {
    setSending(true);
    await new Promise((r) => setTimeout(r, 250));

    const t = (userText || '').toLowerCase();

    // 1) User states completed courses (1437 & 2436)
    if (t.includes('1437') && t.includes('2436')) {
      addBot('Hello Tina!');
      addBot('These are the courses you can take for next semester:');
      addBot(
        [
          'COSC 3340 - Intro to Automata & Computability',
          'COSC 3360 - Database Systems',
          'COSC 4351 - Fund. Of Software Engineering',
        ].join('\n')
      );
      setSending(false);
      return;
    }

    // 2) Ask to switch 3340
    if (t.includes('switch') && t.includes('3340')) {
      localStorage.setItem('swap3340', '1'); // remember for schedule generation
      addBot('Yes! You can instead take COSC 3320 - Algorithms & Data Structures!');
      addBot('You meet the prerequisites and it is offered next semester.');
      setSending(false);
      return;
    }

    // 3) Ask to generate a schedule
    if (
      t.includes('make me a schedule') ||
      t.includes('build my schedule') ||
      (t.includes('schedule') && (t.includes('make') || t.includes('build')))
    ) {
      const sched = makeDemoSchedule();
      try {
        localStorage.setItem('lastSchedule', JSON.stringify(sched));
      } catch {}
      addBot('On it! Check the “Schedule” for your new schedule.');
      addBot('Tell me if you want to make any changes');
      setSending(false);
      return;
    }

    // Fallback
    addBot('Got it! (mock reply)');
    setSending(false);
  }

  // --- text events ---
  function onChange(e) {
    setText(e.target.value);
  }
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
  }

  // --- file upload events (kept for UI; works with mock FilesAPI) ------------
  function openFilePicker() {
    if (sending || uploading) return;
    fileInputRef.current?.click();
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting same file later

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
      await FilesAPI.uploadPdf(file);
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

  // --- render ----------------------------------------------------------------
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

      <form
        className="input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
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
