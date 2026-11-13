import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  clearAIHistory,
  executeBatchScheduleAction,
  executeScheduleAction,
  getAIContextPreview,
  getAIHistory,
  proposeScheduleAction,
  quickAddSchedule,
  sendAIMessageStream,
} from "../api/aiApi";
import { invalidateCache } from "../api/cache";
import { createTask } from "../api/taskApi";
import { processImageForAI } from "../utils/imageCompressor";

const MAX_ATTACHED_IMAGES = 7;

const promptMap = {
  dashboard: [
    "Hôm nay tôi nên ưu tiên việc gì trước?",
    "Thêm môn Học máy tính vào sáng thứ 2 từ 7h đến 9h phòng A2-301",
    "Lên kế hoạch tối nay cho tôi.",
  ],
  schedules: [
    "Thêm môn Học máy tính vào sáng thứ 2 từ 7h đến 9h phòng A2-301",
    "Đổi môn Học máy tính sang 9h đến 11h phòng B102",
    "Xóa môn Học máy tính thứ 2",
    "Thứ 2 tôi học những môn gì?",
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
  "class-notes": [
    "Tóm tắt bài ghi đang chọn giúp tôi.",
    "Rút ý chính và phần cần xem lại.",
    "Tạo câu hỏi ôn tập từ ghi bài.",
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

function isScheduleAgentIntent(text) {
  if (!text) {
    return false;
  }
  const lower = text.toLowerCase().trim();

  // 1. Nhận diện các câu lệnh xóa/hủy lịch học (bao gồm xóa hết, xóa ngày, xóa môn)
  const deletePatterns = [
    /(xóa|hủy|huỷ|bỏ|clear|dọn|xoa|huy)\s+.*(thời khóa biểu|tkb|lịch học|tiết học)/i,
    /(xóa|hủy|huỷ|bỏ|clear|dọn|xoa|huy)\s+(hết|toàn bộ|tất cả|sạch|trắng)?\s*(các\s+)?(môn|lịch|tiết)/i,
    /(xóa|hủy|huỷ|bỏ|clear|dọn|xoa|huy)\s+.*(thứ\s*[2-7]|chủ\s*nhật|cn|hôm nay|ngày mai)/i,
    /(xóa|hủy|huỷ|bỏ|clear)\s+(hết|toàn bộ|tất cả)/i,
  ];
  if (deletePatterns.some((pattern) => pattern.test(lower))) {
    return true;
  }

  // 2. Mẫu câu thêm, sửa, xem
  const crudPatterns = [
    /(thêm|tạo|lên|đăng ký|ghi|nhập|bổ sung)\s+.*(môn|lịch|tiết|buổi|tkb|thời khóa biểu)/i,
    /đặt\s+lịch/i,
    /xếp\s+lịch/i,
    /học\s+môn/i,
    /(đổi|dời|chuyển|sửa|cập nhật|thay đổi)\s+.*(lịch|môn|tiết|giờ|phòng)/i,
    /xem\s+.*(lịch|thời khóa biểu|tkb|môn)/i,
    /(lịch học|thời khóa biểu|tkb)/i,
    /(hôm nay|ngày mai|thứ\s*[2-7]|chủ\s*nhật|cn)\s+(học gì|có môn gì|mấy giờ|học tiết nào)/i,
  ];
  if (crudPatterns.some((pattern) => pattern.test(lower))) {
    return true;
  }

  const hasDay = /(thứ\s*[2-7]|chủ\s*nhật|cn|t[2-7]|hôm nay|ngày mai)/i.test(lower);
  const hasTime = /(\d{1,2}\s*(h|giờ|:\d{2}))/i.test(lower);
  const hasScheduleKeyword = /(môn|lịch|học|phòng|tiết|buổi)/i.test(lower);
  if (hasDay && hasTime && hasScheduleKeyword) {
    return true;
  }

  return false;
}

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

function BatchPreviewCard({ action, onExecuteBatch, onCancel, loading }) {
  const allDrafts = action.batch_drafts || [];
  const [selectedIds, setSelectedIds] = useState(() =>
    allDrafts
      .filter((item) => item.status !== "TIME_OVERLAP" && item.status !== "SAME_SUBJECT")
      .map((item) => item.id)
  );
  const [overrideConflicts, setOverrideConflicts] = useState(false);

  const hasAnyConflict = allDrafts.some(
    (item) => item.status === "TIME_OVERLAP" || item.status === "SAME_SUBJECT"
  );

  const toggleItem = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === allDrafts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allDrafts.map((item) => item.id));
    }
  };

  return (
    <div className="ai-interactive-card ai-batch-preview-card">
      <div className="ai-card-header">
        <span className="ai-card-badge badge-add">📋 TRÍCH XUẤT THỜI KHÓA BIỂU MULTIMODAL</span>
        <span className="ai-batch-count-badge">
          {selectedIds.length}/{allDrafts.length} môn được chọn
        </span>
      </div>
      <div className="ai-card-body">
        <p className="ai-batch-summary">
          {action.summary || `Đã quét được ${allDrafts.length} buổi học từ các ảnh thời khóa biểu. Vui lòng kiểm tra và tích chọn các môn cần lưu:`}
        </p>

        <div className="ai-batch-toolbar">
          <button type="button" className="ai-batch-select-all-btn" onClick={handleSelectAll}>
            {selectedIds.length === allDrafts.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </button>
        </div>

        <div className="ai-batch-items-list">
          {allDrafts.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const isConflict = item.status === "TIME_OVERLAP" || item.status === "SAME_SUBJECT";
            const isNotice = item.status === "ANOTHER_DAY_NOTICE";
            const dayText = item.day_of_week === 1 ? "Chủ nhật" : `Thứ ${item.day_of_week}`;

            return (
              <div
                key={item.id}
                className={`ai-batch-row ${isSelected ? "selected" : ""} ${isConflict ? "conflict" : ""}`}
                onClick={() => toggleItem(item.id)}
              >
                <div className="ai-batch-check-col" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItem(item.id)}
                    id={`batch-item-${item.id}`}
                  />
                </div>
                <div className="ai-batch-info-col">
                  <div className="ai-batch-title-row">
                    <label htmlFor={`batch-item-${item.id}`} className="ai-batch-subject">
                      {item.subject_name}
                    </label>
                    {isConflict && (
                      <span className="ai-conflict-tag conflict">
                        ⚠️ {item.status === "TIME_OVERLAP" ? "Trùng giờ" : "Trùng môn"}
                      </span>
                    )}
                    {isNotice && (
                      <span className="ai-conflict-tag notice">ℹ️ Đã có thứ khác</span>
                    )}
                  </div>
                  <div className="ai-batch-meta-row">
                    <span>🗓️ {dayText}</span>
                    <span>⏰ {item.start_time} - {item.end_time}</span>
                    {item.room && <span>📍 P.{item.room}</span>}
                    {item.teacher && <span>👨‍🏫 {item.teacher}</span>}
                  </div>
                  {item.conflict_detail && (
                    <div className="ai-batch-conflict-msg">
                      {item.conflict_detail}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {hasAnyConflict && (
          <label className="ai-batch-override-toggle">
            <input
              type="checkbox"
              checked={overrideConflicts}
              onChange={(e) => setOverrideConflicts(e.target.checked)}
            />
            <span>Xóa lịch cũ và ghi đè nếu môn được chọn bị trùng giờ/môn</span>
          </label>
        )}
      </div>

      <div className="ai-confirm-actions">
        <button
          type="button"
          className="ai-btn-confirm btn-primary"
          disabled={loading || selectedIds.length === 0}
          onClick={() => onExecuteBatch(action, selectedIds, overrideConflicts)}
        >
          {loading ? "Đang lưu..." : `Lưu ${selectedIds.length} môn đã chọn vào TKB`}
        </button>
        <button
          type="button"
          className="ai-btn-cancel"
          disabled={loading}
          onClick={() => onCancel(action)}
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

function AIFloatingDrawer({ activePage, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);
  const lastPasteTimeRef = useRef(0);

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
    function handleOpenAI(event) {
      setOpen(true);

      if (event.detail?.message) {
        setInput(event.detail.message);
      }

      if (event.detail?.openImagePicker) {
        window.setTimeout(() => imageInputRef.current?.click(), 120);
      }
    }

    window.addEventListener("personal-life:open-ai", handleOpenAI);

    return () => {
      window.removeEventListener("personal-life:open-ai", handleOpenAI);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleExecuteAction(actionItem, overrideConflict = false) {
    if (!actionItem || !actionItem.confirmation_payload) return;
    setLoading(true);
    setError("");

    try {
      const result = await executeScheduleAction({
        action: actionItem.action,
        confirmation_payload: actionItem.confirmation_payload,
        override_conflict: overrideConflict,
      });

      if (result.success) {
        // Cập nhật card của message tương ứng sang COMPLETED
        setMessages((current) =>
          current.map((msg) => {
            const parsed = parseSuggestedAction(msg.suggested_action);
            if (
              parsed &&
              parsed.interactive_type === "schedule_agent" &&
              parsed.messageId === actionItem.messageId
            ) {
              return {
                ...msg,
                suggested_action: JSON.stringify({
                  ...parsed,
                  status: "COMPLETED",
                  completed_message: result.message,
                }),
              };
            }
            return msg;
          })
        );

        setPendingAction(null);
        invalidateCache("dashboard");
        invalidateCache("schedules");
        invalidateCache("student-hub");
        invalidateCache("subjects");

        // Domain Event Bus chuẩn hóa duy nhất (app:data-invalidated)
        window.dispatchEvent(
          new CustomEvent("app:data-invalidated", {
            detail: {
              modules: ["schedules", "subjects", "dashboard", "student-hub"],
              action: result.action,
              source: "ai-floating-drawer",
              data: result.data,
            },
          })
        );
      } else {
        setError(result.message || "Không thể thực thi thao tác.");
      }
    } catch (err) {
      setError(err.message || "Lỗi khi thực thi thao tác.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteBatchAction(actionItem, selectedItemIds, overrideConflicts = false) {
    if (!actionItem) return;
    const allDrafts = actionItem.batch_drafts || [];
    const itemsToSave = allDrafts.filter((item) => selectedItemIds.includes(item.id));
    if (itemsToSave.length === 0) {
      alert("Vui lòng chọn ít nhất 1 môn học để lưu.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await executeBatchScheduleAction({
        items: itemsToSave,
        override_conflicts: overrideConflicts,
      });

      if (result.success) {
        setMessages((current) =>
          current.map((msg) => {
            const parsed = parseSuggestedAction(msg.suggested_action);
            if (
              parsed &&
              parsed.interactive_type === "schedule_agent" &&
              parsed.messageId === actionItem.messageId
            ) {
              return {
                ...msg,
                suggested_action: JSON.stringify({
                  ...parsed,
                  status: "COMPLETED",
                  completed_message: result.message,
                }),
              };
            }
            return msg;
          })
        );

        setPendingAction(null);
        invalidateCache("dashboard");
        invalidateCache("schedules");
        invalidateCache("student-hub");
        invalidateCache("subjects");

        window.dispatchEvent(
          new CustomEvent("app:data-invalidated", {
            detail: {
              modules: ["schedules", "subjects", "dashboard", "student-hub"],
              action: "EXECUTE_BATCH",
              source: "ai-floating-drawer",
              data: result.data,
            },
          })
        );
      } else {
        setError(result.message || "Không thể lưu danh sách thời khóa biểu.");
      }
    } catch (err) {
      setError(err.message || "Lỗi khi lưu thời khóa biểu hàng loạt.");
    } finally {
      setLoading(false);
    }
  }


  function handleCancelAction(actionItem) {
    const targetId = actionItem?.messageId || pendingAction?.messageId;
    if (targetId) {
      setMessages((current) =>
        current.map((msg) => {
          const parsed = parseSuggestedAction(msg.suggested_action);
          if (
            parsed &&
            parsed.interactive_type === "schedule_agent" &&
            parsed.messageId === targetId
          ) {
            return {
              ...msg,
              suggested_action: JSON.stringify({
                ...parsed,
                status: "CANCELLED",
              }),
            };
          }
          return msg;
        })
      );
    }
    setPendingAction(null);
  }

  async function handleSend(nextMessage = input) {
    const trimmed = nextMessage.trim();
    const outgoingImages = [...attachedImages];

    if ((!trimmed && outgoingImages.length === 0) || loading) {
      return;
    }

    const messageText = trimmed || "Hãy đọc ảnh thời khóa biểu này và trích xuất lịch học.";
    const optimisticMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: messageText,
      image_preview: outgoingImages[0]?.previewUrl || null,
      images_preview: outgoingImages.map((img) => img.previewUrl),
      created_at: new Date().toISOString(),
    };

    // 1. Kiểm tra xác nhận tự nhiên bằng lời nếu đang có pendingAction
    if (pendingAction && outgoingImages.length === 0) {
      const isConfirm = /^(đồng ý|ok|xác nhận|thực hiện|làm đi|xóa đi|xóa luôn|xóa hết|xóa tất cả|chắc chắn|yes|yep|agree|chuẩn rồi|được|ok nhé|đồng ý luôn|xóa)$/i.test(trimmed);
      const isOverride = /^(ghi đè|xóa lịch cũ|xóa cũ|đồng ý ghi đè|đè lên|override)$/i.test(trimmed);
      const isCancel = /^(hủy|hủy bỏ|thôi|không|bỏ qua|cancel|no|ko|thôi khỏi|dừng lại)$/i.test(trimmed);

      if (isConfirm || isOverride) {
        setMessages((current) => [...current, optimisticMessage]);
        setInput("");
        const shouldOverride = isOverride || (pendingAction.status === "CONFLICT_DETECTED" && isOverride);
        await handleExecuteAction(pendingAction, shouldOverride);
        return;
      }

      if (isCancel) {
        const cancelMsg = {
          id: `cancel-${Date.now()}`,
          role: "model",
          content: "Đã hủy bỏ thao tác thời khóa biểu.",
          created_at: new Date().toISOString(),
        };
        setMessages((current) => [...current, optimisticMessage, cancelMsg]);
        setInput("");
        handleCancelAction(pendingAction);
        return;
      }
    }

    // 2. Kiểm tra câu lệnh Schedule Agent (CRUD Thời khóa biểu hoặc có ảnh thời khóa biểu)
    const isSchedule =
      outgoingImages.length > 0 ||
      isScheduleAgentIntent(messageText) ||
      activePage === "schedules" ||
      /(môn|lịch|tkb|thời khóa biểu|học)/i.test(messageText);

    if (isSchedule) {
      const scheduleMsgId = `schedule-${Date.now()}`;
      const scheduleLoadingMsg = {
        id: scheduleMsgId,
        role: "model",
        content: outgoingImages.length > 0
          ? `⏳ Đang phân tích ${outgoingImages.length} ảnh thời khóa biểu và trích xuất lịch học...`
          : "⏳ Đang phân tích yêu cầu thời khóa biểu...",
        created_at: new Date().toISOString(),
      };

      setMessages((current) => [...current, optimisticMessage, scheduleLoadingMsg]);
      setInput("");
      setAttachedImages([]); // Edge-case: Dọn sạch state đính kèm sau khi gửi
      setError("");
      setLoading(true);

      try {
        const response = await proposeScheduleAction(
          messageText,
          outgoingImages
        );

        if (
          response.status === "BATCH_READY_TO_CONFIRM" ||
          response.status === "CONFLICT_DETECTED" ||
          response.status === "READY_TO_CONFIRM"
        ) {
          const actionPayload = {
            ...response,
            interactive_type: "schedule_agent",
            messageId: scheduleMsgId,
          };
          const finalMessage = {
            id: scheduleMsgId,
            role: "model",
            content: response.message,
            suggested_action: JSON.stringify(actionPayload),
            created_at: new Date().toISOString(),
          };
          setMessages((current) =>
            current.map((msg) => (msg.id === scheduleMsgId ? finalMessage : msg))
          );
          setPendingAction(actionPayload);
        } else {
          // NO_ACTION (e.g. VIEW) hoặc NEED_INFO
          const finalMessage = {
            id: scheduleMsgId,
            role: "model",
            content: response.message,
            created_at: new Date().toISOString(),
          };
          setMessages((current) =>
            current.map((msg) => (msg.id === scheduleMsgId ? finalMessage : msg))
          );
          setPendingAction(null);
        }
      } catch (err) {
        setError(err.message || "AI chưa xử lý được yêu cầu thời khóa biểu.");
        setMessages((current) => current.filter((msg) => msg.id !== scheduleMsgId));
      } finally {
        setLoading(false);
      }
      return;
    }

    const streamingId = `stream-${Date.now()}`;
    const streamingMessage = {
      id: streamingId,
      role: "model",
      content: "",
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage, streamingMessage]);
    setInput("");
    setAttachedImages([]);
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
          imageBase64: outgoingImages[0]?.base64 || null,
          imageMimeType: outgoingImages[0]?.mimeType || null,
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

  async function handleAddFiles(files) {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const remainingSlots = MAX_ATTACHED_IMAGES - attachedImages.length;
    if (remainingSlots <= 0) {
      alert("Bạn chỉ có thể đính kèm tối đa 7 ảnh một lúc.");
      return;
    }

    const filesToProcess = imageFiles.slice(0, remainingSlots);
    if (imageFiles.length > remainingSlots) {
      alert(`Đã đạt giới hạn 7 ảnh. Chỉ thêm ${remainingSlots} ảnh hợp lệ.`);
    }

    try {
      setError("");
      const newImages = [];
      for (const file of filesToProcess) {
        const processed = await processImageForAI(file, 1280, 0.8);
        newImages.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name || `image_${Date.now()}.jpg`,
          base64: processed.base64,
          mimeType: processed.mimeType,
          previewUrl: processed.previewUrl,
          sizeKb: processed.sizeKb,
          skippedCompression: processed.skippedCompression,
        });
      }
      setAttachedImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      setError(err.message || "Không thể xử lý ảnh này.");
    }
  }

  function handleRemoveImage(id) {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id));
  }

  function handleClearAllImages() {
    setAttachedImages([]);
  }

  async function handleImageSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      await handleAddFiles(files);
    }
    event.target.value = "";
  }

  async function handlePaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;

    const now = Date.now();
    if (now - lastPasteTimeRef.current < 300) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const seenKeys = new Set();
    const files = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const key = `${file.size}_${file.type}_${file.name}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            files.push(file);
          }
        }
      }
    }

    if (files.length > 0) {
      lastPasteTimeRef.current = now;
      event.preventDefault();
      event.stopPropagation();
      await handleAddFiles(files);
    }
  }


  function handleDragOver(event) {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false);
    }
  }

  async function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleAddFiles(files);
    }
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

    // Interactive Schedule Agent Cards
    if (action.interactive_type === "schedule_agent") {
      if (action.status === "BATCH_READY_TO_CONFIRM" || (action.batch_drafts && action.batch_drafts.length > 0)) {
        return (
          <BatchPreviewCard
            action={action}
            onExecuteBatch={handleExecuteBatchAction}
            onCancel={handleCancelAction}
            loading={loading}
          />
        );
      }

      if (action.status === "COMPLETED") {
        return (
          <div className="ai-interactive-card completed">
            <div className="ai-card-badge badge-completed">✅ Đã hoàn thành</div>
            <p className="ai-card-completed-msg">
              {action.completed_message || "Thao tác thời khóa biểu đã được thực hiện thành công."}
            </p>
            <button
              type="button"
              className="ai-schedule-view-btn"
              onClick={() => {
                if (onNavigate) {
                  onNavigate("schedules");
                }
                window.dispatchEvent(
                  new CustomEvent("personal-life:navigate", { detail: "schedules" })
                );
                setOpen(false);
              }}
            >
              Xem Thời khóa biểu →
            </button>
          </div>
        );
      }

      if (action.status === "CANCELLED") {
        return (
          <div className="ai-interactive-card cancelled">
            <span className="ai-card-badge badge-cancelled">❌ Đã hủy bỏ</span>
            <p className="ai-card-completed-msg">Thao tác này đã bị hủy bỏ theo yêu cầu của bạn.</p>
          </div>
        );
      }

      if (action.status === "CONFLICT_DETECTED") {
        return (
          <div className="ai-interactive-card ai-conflict-box">
            <div className="ai-card-header">
              <span className="ai-card-badge badge-conflict">⚠️ Phát hiện trùng lịch</span>
            </div>
            <div className="ai-card-body">
              <div className="ai-conflict-section">
                <strong>Lịch hiện có bị trùng:</strong>
                {action.conflicts?.map((c, i) => (
                  <div key={i} className="ai-conflict-row">
                    <span>📌 <strong>{c.subject_name}</strong></span>
                    <small>Thứ {c.day_of_week === 1 ? "CN" : c.day_of_week} ({c.start_time} - {c.end_time}){c.room ? ` · P.${c.room}` : ""}</small>
                  </div>
                ))}
              </div>
              <div className="ai-conflict-section target">
                <strong>Lịch dự kiến thêm:</strong>
                <div className="ai-conflict-row">
                  <span>✨ <strong>{action.draft?.subject_name}</strong></span>
                  <small>Thứ {action.draft?.day_of_week === 1 ? "CN" : action.draft?.day_of_week} ({action.draft?.start_time} - {action.draft?.end_time}){action.draft?.room ? ` · P.${action.draft.room}` : ""}</small>
                </div>
              </div>
            </div>
            <div className="ai-conflict-actions">
              <button
                type="button"
                className="ai-btn-override"
                disabled={loading}
                onClick={() => handleExecuteAction(action, true)}
                title="Xóa lịch cũ bị trùng và ghi đè lịch mới này"
              >
                Xóa lịch cũ & Ghi đè
              </button>
              <button
                type="button"
                className="ai-btn-edit"
                disabled={loading}
                onClick={() => {
                  setInput(`Đổi giờ môn ${action.draft?.subject_name || ""} sang `);
                }}
              >
                Chỉnh sửa lại giờ
              </button>
              <button
                type="button"
                className="ai-btn-cancel"
                disabled={loading}
                onClick={() => handleCancelAction(action)}
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        );
      }

      if (action.status === "READY_TO_CONFIRM") {
        const isDelete = action.action === "DELETE";
        const isUpdate = action.action === "UPDATE";
        const deleteMode = action.confirmation_payload?.delete_mode || "SINGLE";

        let badgeClass = "badge-add";
        let badgeLabel = "XÁC NHẬN THÊM MỚI";
        if (isUpdate) {
          badgeClass = "badge-update";
          badgeLabel = "XÁC NHẬN CẬP NHẬT";
        } else if (isDelete) {
          badgeClass = "badge-delete";
          if (deleteMode === "ALL") {
            badgeLabel = "XÁC NHẬN XÓA TOÀN BỘ";
          } else if (deleteMode === "DAY") {
            badgeLabel = `XÁC NHẬN XÓA ${action.confirmation_payload?.day_label || "NGÀY"}`;
          } else {
            badgeLabel = "XÁC NHẬN XÓA BỎ";
          }
        }

        const subjectTitle = action.draft?.subject_name || action.confirmation_payload?.subject_name || "Môn học";
        const dayText = action.draft?.day_of_week
          ? (action.draft.day_of_week === 1 ? "Chủ nhật" : `Thứ ${action.draft.day_of_week}`)
          : (action.confirmation_payload?.day_label || "");

        return (
          <div className={`ai-interactive-card ai-confirm-box ${isDelete ? "danger" : isUpdate ? "info" : "success"}`}>
            <div className="ai-card-header">
              <span className={`ai-card-badge ${badgeClass}`}>{badgeLabel}</span>
            </div>
            <div className="ai-card-body">
              <h4 className="ai-card-title">{subjectTitle}</h4>
              {isUpdate && action.confirmation_payload?.old_info && (
                <div className="ai-card-diff">
                  <div className="diff-old">
                    <span className="diff-label">Hiện tại</span>
                    <span>{action.confirmation_payload.old_info.day_label} ({action.confirmation_payload.old_info.time})</span>
                  </div>
                  <div className="diff-arrow">➔</div>
                  <div className="diff-new">
                    <span className="diff-label">Mới</span>
                    <strong>{action.confirmation_payload.new_info.day_label} ({action.confirmation_payload.new_info.time})</strong>
                  </div>
                </div>
              )}
              {!isUpdate && !isDelete && (
                <div className="ai-card-details">
                  <div>🗓️ {dayText} {action.draft?.start_time ? `(${action.draft.start_time} - ${action.draft.end_time})` : (action.confirmation_payload?.time ? `(${action.confirmation_payload.time})` : "")}</div>
                  {action.draft?.room && <div>📍 Phòng: {action.draft.room}</div>}
                  {action.draft?.teacher && <div>👨‍🏫 GV: {action.draft.teacher}</div>}
                </div>
              )}
              {isDelete && (
                <div className="ai-card-details">
                  {deleteMode === "ALL" ? (
                    <div>🗑️ Xóa toàn bộ <strong>{action.confirmation_payload?.count}</strong> tiết học trong thời khóa biểu.</div>
                  ) : deleteMode === "DAY" ? (
                    <div>🗑️ Xóa tất cả <strong>{action.confirmation_payload?.count}</strong> môn học vào <strong>{action.confirmation_payload?.day_label}</strong>.</div>
                  ) : (
                    <div>🗓️ {dayText} {action.confirmation_payload?.time ? `(${action.confirmation_payload.time})` : ""}</div>
                  )}
                  <p className="ai-card-warning">⚠️ Thao tác này sẽ xóa vĩnh viễn và không thể hoàn tác.</p>
                </div>
              )}
            </div>
            <div className="ai-confirm-actions">
              <button
                type="button"
                className={`ai-btn-confirm ${isDelete ? "btn-danger" : "btn-primary"}`}
                disabled={loading}
                onClick={() => handleExecuteAction(action, false)}
              >
                {isDelete
                  ? (deleteMode === "ALL" ? "Xóa toàn bộ thời khóa biểu" : deleteMode === "DAY" ? `Xóa các môn ${action.confirmation_payload?.day_label || ""}` : "Xóa lịch này")
                  : "Xác nhận thực hiện"}
              </button>
              <button
                type="button"
                className="ai-btn-cancel"
                disabled={loading}
                onClick={() => handleCancelAction(action)}
              >
                Hủy
              </button>
            </div>
          </div>
        );
      }
    }

    if (action.type === "create_schedule" || action.action === "create_schedule") {
      return (
        <div className="ai-schedule-card">
          <div className="ai-schedule-header">
            <span className="ai-schedule-badge">📅 Thời khóa biểu mới</span>
            {action.created_new_subject && (
              <span className="ai-subject-badge">Môn mới</span>
            )}
          </div>
          <strong className="ai-schedule-title">{action.subject_name}</strong>
          <div className="ai-schedule-details">
            <div>
              <span>🗓️ {action.day_label || `Thứ ${action.day_of_week}`}</span>
              <span>⏰ {action.start_time} - {action.end_time}</span>
            </div>
            {action.room && <div>📍 Phòng: {action.room}</div>}
            {action.teacher && <div>👨‍🏫 GV: {action.teacher}</div>}
          </div>
          {action.conflict_warning && (
            <div className="ai-schedule-conflict">
              <span>⚠️ {action.conflict_warning}</span>
            </div>
          )}
          <div className="ai-schedule-actions">
            <button
              type="button"
              className="ai-schedule-view-btn"
              onClick={() => {
                if (onNavigate) {
                  onNavigate("schedules");
                }
                window.dispatchEvent(
                  new CustomEvent("personal-life:navigate", { detail: "schedules" })
                );
                setOpen(false);
              }}
            >
              Xem Thời khóa biểu →
            </button>
          </div>
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

      <aside
        className={`ai-drawer ${open ? "open" : ""} ${isDragging ? "dragging" : ""}`}
        aria-hidden={!open}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <header className="ai-drawer-header">
          <div>
            <strong>Trợ lý AI</strong>
            <span>Trợ lý AI quản lý học tập & thời khóa biểu.</span>
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
                      {message.images_preview && message.images_preview.length > 0 ? (
                        <div className="ai-message-gallery">
                          {message.images_preview.map((src, idx) => (
                            <img
                              key={idx}
                              className="ai-gallery-thumb"
                              src={src}
                              alt={`Ảnh đính kèm ${idx + 1}`}
                            />
                          ))}
                        </div>
                      ) : message.image_preview ? (
                        <img
                          className="ai-message-image"
                          src={message.image_preview}
                          alt="Ảnh người dùng gửi cho AI"
                        />
                      ) : null}
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
                placeholder="Hỏi AI về lịch, deadline, học tập... (dán tối đa 7 ảnh Ctrl+V hoặc kéo thả)"
              />
              <button

                className="ai-icon-button"
                type="button"
                onClick={() => imageInputRef.current?.click()}
                title="Đính kèm ảnh thời khóa biểu (tối đa 7 ảnh)"
                aria-label="Đính kèm ảnh thời khóa biểu"
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
              multiple
              onChange={handleImageSelect}
              hidden
            />
            {attachedImages.length > 0 && (
              <div className="ai-multi-attachment-bar">
                <div className="ai-attachment-bar-header">
                  <span>Ảnh đính kèm ({attachedImages.length}/{MAX_ATTACHED_IMAGES})</span>
                  {attachedImages.length >= 2 && (
                    <button
                      type="button"
                      className="ai-clear-all-thumbs"
                      onClick={handleClearAllImages}
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>
                <div className="ai-attachment-thumbnails-scroll">
                  {attachedImages.map((img) => (
                    <div key={img.id} className="ai-attachment-thumb-item">
                      <img src={img.previewUrl} alt={img.name} />
                      <button
                        type="button"
                        className="ai-remove-thumb-btn"
                        onClick={() => handleRemoveImage(img.id)}
                        title="Gỡ ảnh này"
                      >
                        ✕
                      </button>
                      <span className="ai-thumb-size">{img.sizeKb}KB</span>
                    </div>
                  ))}
                </div>
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
