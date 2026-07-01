import { API_URL, apiFetch, getAuthToken } from "./config";

export async function getFiles(module = "documents", keyword = "") {
  const params = new URLSearchParams();

  if (module) {
    params.set("module", module);
  }

  if (keyword) {
    params.set("keyword", keyword);
  }

  const query = params.toString();
  const response = await apiFetch(`${API_URL}/files/${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error("Cannot load files");
  }

  return response.json();
}

function buildFileFormData(data) {
  const formData = new FormData();

  if (data.upload_file) {
    formData.append("upload_file", data.upload_file);
  }

  formData.append("title", data.title || "");
  formData.append("file_type", data.file_type || "other");
  formData.append("module", data.module || "documents");
  formData.append("subject", data.subject || "");
  formData.append("project_name", data.project_name || "");
  formData.append("url", data.url || "");
  formData.append("tags", data.tags || "");
  formData.append("note", data.note || "");

  return formData;
}

export async function createFileRecord(data) {
  const response = await apiFetch(`${API_URL}/files/`, {
    method: "POST",
    body: buildFileFormData(data),
  });

  if (!response.ok) {
    throw new Error("Cannot create file record");
  }

  return response.json();
}

export async function updateFileRecord(fileId, data) {
  const response = await apiFetch(`${API_URL}/files/${fileId}`, {
    method: "PUT",
    body: buildFileFormData(data),
  });

  if (!response.ok) {
    throw new Error("Cannot update file record");
  }

  return response.json();
}

export async function deleteFileRecord(fileId) {
  const response = await apiFetch(`${API_URL}/files/${fileId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete file");
  }

  return response.json();
}


export function getFileInlineUrl(fileId, publicToken = "") {
  const query = publicToken ? `?token=${encodeURIComponent(publicToken)}` : "";

  return `${API_URL}/files/${fileId}/inline${query}`;
}

export async function uploadEditorImage(file, metadata = {}) {
  const response = await createFileRecord({
    upload_file: file,
    title: metadata.title || file.name || "Ảnh ghi chép",
    file_type: "image",
    module: metadata.module || "class_note",
    subject: metadata.subject || "",
    tags: metadata.tags || "#anh-ghi-chep",
    note: metadata.note || "Ảnh chèn từ RichTextEditor",
  });

  return {
    ...response,
    inlineUrl: getFileInlineUrl(response.id, response.public_token),
  };
}

export function getFileDownloadUrl(fileId) {
  const token = getAuthToken();
  const query = token ? `?access_token=${encodeURIComponent(token)}` : "";

  return `${API_URL}/files/${fileId}/download${query}`;
}
