import '../css/components/chat-bubble.css';

export default function ChatBubble({ from = 'bot', children }) {
  const mine = from === 'you';
  return (
    <div className={`msg-row ${mine ? 'from-you' : 'from-bot'}`}>
      <div className="msg-bubble">{children}</div>
    </div>
  );
}
