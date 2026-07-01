import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  clearAIHistory,
  getAIContextPreview,
  getAIHistory,
  sendAIMessageStream,
} from "../api/aiApi";
import { invalidateCache } from "../api/cache";
import { createExpense } from "../api/expensesApi";
import { createTask } from "../api/taskApi";

const promptMap = {
  dashboard: [
    "Hôm nay tôi nên ưu tiên việc gì trước?",
    "Tôi có đang bị quá tải không?",
    "Lên kế hoạch tối nay cho tôi.",
  ],
  expenses: [
    "Tháng này tôi tiêu ổn không?",
    "Tôi có khoản chi nào bất thường không?",
    "Gợi ý cách tiết kiệm trong tuần này.",
  ],
  deadlines: [
    "Deadline nào cần xử lý trước?",
    "Tôi nên chia deadline tuần này thế nào?",
    "Có việc nào đang sát hạn không?",
  ],
  subjects: [
    "Môn nào tôi nên tập trung nhất?",
    "Tôi cần cải thiện phần học tập nào?",
    "Tóm tắt rủi ro điểm và chuyên cần.",
  ],
  "student-hub": [
    "Tình hình học tập hiện tại của tôi thế nào?",
    "Môn nào có nguy cơ thấp điểm?",
    "Tôi nên ôn gì trong 2 giờ tới?",
  ],
  study: [
    "Gợi ý kế hoạch học tối nay.",
    "Tôi nên học môn nào trước?",
    "Tạo checklist ôn tập ngắn cho hôm nay.",
  ],
  people: [
    "Tôi nên chăm sóc mối quan hệ nào trước?",
    "Có ai lâu rồi tôi chưa liên hệ không?",
    "Gợi ý hành động nhỏ để giữ liên lạc.",
  ],
  journal: [
    "Tóm tắt xu hướng gần đây của tôi.",
    "Tôi nên chú ý điều gì từ nhật ký?",
    "Gợi ý một câu hỏi tự phản tư hôm nay.",
  ],
};

const defaultPrompts = [
  "Hôm nay tôi nên làm gì trước?",
  "Tóm tắt tình hình hiện tại của tôi.",
  "Tôi nên ưu tiên học tập, deadline hay nghỉ ngơi?",
];

function parseSuggestedAction(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("AI trả về sai định dạng JSON", error);
    return null;
  }
}

function AIFloatingDrawer({ activePage }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);

  const suggestedPrompts = useMemo(
    () => promptMap[activePage] || defaultPrompts,
    [activePage],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    getAIHistory()
      .then(setMessages)
      .catch((err) => setError(err.message));
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(nextMessage = input) {
    const trimmed = nextMessage.trim();
    const outgoingImage = attachedImage;

    if ((!trimmed && !outgoingImage) || loading) {
      return;
    }

    const messageText = trimmed || "Hãy đọc ảnh hóa đơn này.";
    const optimisticMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: messageText,
      image_preview: outgoingImage?.previewUrl || null,
      created_at: new Date().toISOString(),
    };
    const streamingId = `stream-${Date.now()}`;
    const streamingMessage = {
      id: streamingId,
      role: "model",
      content: "",
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage, streamingMessage]);
    setInput("");
    setAttachedImage(null);
    setError("");
    setLoading(true);

    try {
      await sendAIMessageStream(
        messageText,
        {
          onDelta: (chunk) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === streamingId
                  ? { ...message, content: `${message.content}${chunk}` }
                  : message,
              ),
            );
          },
          onFinal: (finalMessage) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === streamingId ? finalMessage : message,
              ),
            );
          },
        },
        {
          imageBase64: outgoingImage?.base64 || null,
          imageMimeType: outgoingImage?.mimeType || null,
        },
      );
    } catch (err) {
      setError(err.message || "AI chưa phản hồi được.");
      setMessages((current) => current.filter((message) => message.id !== streamingId));
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview() {
    try {
      setError("");
      const data = await getAIContextPreview();
      setPreview(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClearHistory() {
    const confirmed = window.confirm("Xóa toàn bộ lịch sử chat AI của tài khoản này?");

    if (!confirmed) {
      return;
    }

    try {
      await clearAIHistory();
      setMessages([]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleApplyAction(action) {
    if (!action) {
      return;
    }

    try {
      if (action.type === "create_expense" || action.action === "create_expense") {
        const createdExpense = await createExpense({
          transaction_type: action.transaction_type || "expense",
          amount: Number(action.amount || 0),
          category: action.category || "other",
          transaction_date: action.transaction_date || new Date().toISOString().slice(0, 10),
          payment_method: action.payment_method || "cash",
          note: action.note || "Tạo từ ảnh hóa đơn qua Trợ lý AI.",
        });
        invalidateCache("dashboard");
        invalidateCache("expenses");
        invalidateCache("student-hub");
        window.dispatchEvent(
          new CustomEvent("personal-life:expenses-changed", {
            detail: { source: "ai", expenseId: createdExpense?.id || null },
          }),
        );
        alert("Đã tạo khoản chi từ ảnh hóa đơn.");
        return;
      }

      if (action.type !== "create_task" && action.action !== "create_task") {
        return;
      }

      const createdTask = await createTask({
        title: action.title,
        task_date: action.task_date,
        priority: action.priority || "medium",
        status: "pending",
        note: action.note || "Tạo từ đề xuất của Trợ lý AI.",
      });
      invalidateCache("dashboard");
      invalidateCache("tasks");
      invalidateCache("student-hub");
      window.dispatchEvent(
        new CustomEvent("personal-life:tasks-changed", {
          detail: { source: "ai", taskId: createdTask?.id || null },
        }),
      );
      alert("Đã tạo task từ đề xuất AI.");
    } catch (err) {
      setError(err.message || "Không tạo được task từ đề xuất AI.");
    }
  }

  function handleImageSelect(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Ảnh quá lớn. Hãy chọn ảnh dưới 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAttachedImage({
        name: file.name,
        mimeType: file.type,
        base64: dataUrl,
        previewUrl: dataUrl,
      });
      setError("");
    };
    reader.onerror = () => {
      setError("Không đọc được ảnh này.");
    };
    reader.readAsDataURL(file);
  }

  function handleVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Trình duyệt này chưa hỗ trợ nhập giọng nói. Hãy thử Chrome hoặc Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setError("");
      setListening(true);
    };

    recognition.onerror = () => {
      setListening(false);
      setError("Không nghe được giọng nói. Bạn thử bấm micro lại nhé.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";

      if (transcript) {
        setInput((current) => `${current ? `${current} ` : ""}${transcript}`.trim());
      }
    };

    recognition.start();
  }

  function renderSuggestedAction(message) {
    const action = parseSuggestedAction(message.suggested_action);

    if (!action) {
      return null;
    }

    if (action.type === "create_expense" || action.action === "create_expense") {
      return (
        <div className="ai-action-card">
          <span>Đề xuất khoản chi</span>
          <strong>{Number(action.amount || 0).toLocaleString("vi-VN")} đ</strong>
          <small>
            Danh mục: {action.category || "other"} · Ngày: {action.transaction_date}
          </small>
          <button type="button" onClick={() => handleApplyAction(action)}>
            Tạo khoản chi này
          </button>
        </div>
      );
    }

    if (action.type !== "create_task" && action.action !== "create_task") {
      return null;
    }

    return (
      <div className="ai-action-card">
        <span>Đề xuất hành động</span>
        <strong>{action.title}</strong>
        <small>Ngày: {action.task_date} · Ưu tiên: {action.priority || "medium"}</small>
        <button type="button" onClick={() => handleApplyAction(action)}>
          Tạo Task này
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        className="ai-fab"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Mở Trợ lý AI"
      >
        AI
      </button>

      <aside className={`ai-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <header className="ai-drawer-header">
          <div>
            <strong>Trợ lý AI</strong>
            <span>AI cố vấn, chỉ đọc dữ liệu được cho phép.</span>
          </div>

          <button type="button" onClick={() => setOpen(false)}>
            Đóng
          </button>
        </header>

        {error && <p className="ai-error">{error}</p>}

        <section className="ai-messages">
          {messages.length === 0 ? (
            <div className="ai-empty">
              <p>Chọn một câu hỏi gợi ý hoặc nhập điều bạn muốn hỏi.</p>
              <div className="ai-suggested-list">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <article className={`ai-message ${message.role}`} key={message.id}>
                <div className="ai-message-bubble">
                  {message.role === "model" ? (
                    <ReactMarkdown className="ai-markdown" remarkPlugins={[remarkGfm]}>
                      {message.content || "Đang kết nối với Gemini..."}
                    </ReactMarkdown>
                  ) : (
                    <>
                      <p>{message.content}</p>
                      {message.image_preview && (
                        <img
                          className="ai-message-image"
                          src={message.image_preview}
                          alt="Ảnh người dùng gửi cho AI"
                        />
                      )}
                    </>
                  )}
                </div>
                {message.role === "model" && renderSuggestedAction(message)}
              </article>
            ))
          )}

          <div ref={bottomRef} />
        </section>

        <footer className="ai-composer">
          <div className="ai-composer-tools">
            <button type="button" onClick={handlePreview}>
              Dữ liệu cấp cho AI
            </button>
            <button type="button" onClick={handleClearHistory}>
              Xóa lịch sử
            </button>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            <div className="ai-input-row">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Hỏi AI về lịch, deadline, học tập, chi tiêu..."
              />
              <button
                className="ai-icon-button"
                type="button"
                onClick={() => imageInputRef.current?.click()}
                title="Gửi ảnh hóa đơn"
                aria-label="Gửi ảnh hóa đơn"
              >
                🖼️
              </button>
              <button
                className={`ai-mic-button ${listening ? "listening" : ""}`}
                type="button"
                onClick={handleVoiceInput}
                title="Nhập bằng giọng nói"
                aria-label="Nhập bằng giọng nói"
              >
                🎤
              </button>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageSelect}
              hidden
            />
            {attachedImage && (
              <div className="ai-attachment-preview">
                <img src={attachedImage.previewUrl} alt="Ảnh sẽ gửi cho AI" />
                <div>
                  <strong>{attachedImage.name}</strong>
                  <span>Ảnh sẽ được gửi cho Gemini Vision khi bạn bấm Gửi.</span>
                </div>
                <button type="button" onClick={() => setAttachedImage(null)}>
                  Gỡ
                </button>
              </div>
            )}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Đang suy nghĩ..." : "Gửi"}
            </button>
          </form>
        </footer>
      </aside>

      {preview && (
        <div className="ai-preview-backdrop" role="dialog" aria-modal="true">
          <div className="ai-preview-modal">
            <header>
              <h3>Dữ liệu sẽ cấp cho AI</h3>
              <button type="button" onClick={() => setPreview(null)}>
                Đóng
              </button>
            </header>
            <pre>{JSON.stringify(preview, null, 2)}</pre>
          </div>
        </div>
      )}
    </>
  );
}

export default AIFloatingDrawer;
