import { API_URL, apiFetch, notifyError } from "./config";

const AI_RATE_LIMIT_MESSAGE =
  "Trợ lý AI đang suy nghĩ hơi nhiều, bạn nạp năng lượng đợi 1 phút rồi thử lại nhé!";

async function parseResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      response.status === 429
        ? AI_RATE_LIMIT_MESSAGE
        : data.detail || fallbackMessage;
    notifyError(message);
    throw new Error(message);
  }

  return data;
}

export async function getAISettings() {
  const response = await apiFetch(`${API_URL}/api/ai/settings`);
  return parseResponse(response, "Không tải được cài đặt AI.");
}

export async function updateAISettings(settings) {
  const response = await apiFetch(`${API_URL}/api/ai/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  return parseResponse(response, "Không lưu được cài đặt AI.");
}

export async function getAIHistory() {
  const response = await apiFetch(`${API_URL}/api/ai/history`);
  return parseResponse(response, "Không tải được lịch sử AI.");
}

export async function clearAIHistory() {
  const response = await apiFetch(`${API_URL}/api/ai/history`, {
    method: "DELETE",
  });

  return parseResponse(response, "Không xóa được lịch sử AI.");
}

export async function getAIContextPreview() {
  const response = await apiFetch(`${API_URL}/api/ai/context-preview`);
  return parseResponse(response, "Không xem được dữ liệu cấp cho AI.");
}

export async function sendAIMessage(message, media = {}) {
  const response = await apiFetch(`${API_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      image_base64: media.imageBase64 || null,
      image_mime_type: media.imageMimeType || null,
    }),
  });

  return parseResponse(response, "Không gửi được câu hỏi cho AI.");
}

export async function sendAIMessageStream(message, handlers = {}, media = {}) {
  const response = await apiFetch(`${API_URL}/api/ai/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      image_base64: media.imageBase64 || null,
      image_mime_type: media.imageMimeType || null,
    }),
  });

  if (!response.ok || !response.body) {
    await parseResponse(response, "Không gửi được câu hỏi cho AI.");
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalMessage = null;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const eventText of events) {
      const line = eventText
        .split("\n")
        .find((item) => item.startsWith("data: "));

      if (!line) {
        continue;
      }

      let payload;

      try {
        payload = JSON.parse(line.replace("data: ", ""));
      } catch (error) {
        console.error("AI trả về sai định dạng JSON", error);
        continue;
      }

      if (payload.type === "delta") {
        handlers.onDelta?.(payload.content || "");
      }

      if (payload.type === "error") {
        const message =
          payload.code === "rate_limit"
            ? AI_RATE_LIMIT_MESSAGE
            : payload.message || "AI đang gặp lỗi, thử lại sau một chút.";
        notifyError(message);
        handlers.onError?.(payload);
      }

      if (payload.type === "final") {
        finalMessage = payload.message;
        handlers.onFinal?.(payload.message);
      }
    }
  }

  return finalMessage;
}

export async function quickAddSchedule(prompt) {
  const response = await apiFetch(`${API_URL}/api/ai/quick-schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  return parseResponse(response, "Không thể thêm lịch học tự động.");
}

export async function proposeScheduleAction(prompt, images = [], imageBase64 = null, imageMimeType = null) {
  const payload = { prompt };
  if (Array.isArray(images) && images.length > 0) {
    payload.images = images.map((img) => ({
      base64: img.base64,
      mime_type: img.mimeType || "image/jpeg",
    }));
  } else if (imageBase64) {
    payload.image_base64 = imageBase64;
    payload.image_mime_type = imageMimeType || "image/jpeg";
  }

  const response = await apiFetch(`${API_URL}/api/ai/schedule/propose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response, "Không thể phân tích yêu cầu thời khóa biểu.");
}

export async function executeScheduleAction({
  action,
  confirmation_payload,
  override_conflict = false,
}) {
  const response = await apiFetch(`${API_URL}/api/ai/schedule/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      confirmation_payload,
      override_conflict,
    }),
  });

  return parseResponse(response, "Không thể thực thi thao tác thời khóa biểu.");
}

export async function executeBatchScheduleAction({
  items,
  override_conflicts = false,
}) {
  const response = await apiFetch(`${API_URL}/api/ai/schedule/execute-batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items,
      override_conflicts,
    }),
  });

  return parseResponse(response, "Không thể lưu danh sách thời khóa biểu hàng loạt.");
}

