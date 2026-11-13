/**
 * Tiện ích nén và tối ưu hóa ảnh cho Trợ lý AI (Multimodal LLM)
 * - Bảo toàn độ nét OCR cho văn bản thời khóa biểu (bỏ qua nén nếu <= 300KB và width <= 1280px)
 * - Tự động co tỷ lệ và nén Canvas nếu kích thước lớn (> 300KB hoặc width > 1280px)
 */

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Xử lý file ảnh trước khi gửi lên AI
 * @param {File|Blob} file
 * @param {number} maxDimension Chiều dài/rộng tối đa (mặc định 1280px)
 * @param {number} quality Chất lượng JPEG (0.8)
 * @returns {Promise<{base64: string, mimeType: string, sizeKb: number, fileName: string, skippedCompression: boolean}>}
 */
export async function processImageForAI(file, maxDimension = 1280, quality = 0.8) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Tệp được chọn không phải là ảnh hợp lệ.");
  }

  const originalDataUrl = await readFileAsDataURL(file);
  const img = await loadImage(originalDataUrl);

  const { naturalWidth, naturalHeight } = img;
  const isSmallFile = file.size <= 300 * 1024;
  const isSmallDimension = naturalWidth <= maxDimension && naturalHeight <= maxDimension;

  // Edge-case: Bảo toàn chất lượng gốc nếu file nhỏ và kích thước không vượt quá giới hạn
  if (isSmallFile && isSmallDimension) {
    const base64Data = originalDataUrl.split(",")[1];
    return {
      base64: base64Data,
      mimeType: file.type || "image/png",
      previewUrl: originalDataUrl,
      sizeKb: Math.round(file.size / 1024),
      fileName: file.name || "attached_image.png",
      skippedCompression: true,
    };
  }

  // Cần scale và nén qua Canvas
  let targetWidth = naturalWidth;
  let targetHeight = naturalHeight;

  if (naturalWidth > maxDimension || naturalHeight > maxDimension) {
    const ratio = Math.min(maxDimension / naturalWidth, maxDimension / naturalHeight);
    targetWidth = Math.round(naturalWidth * ratio);
    targetHeight = Math.round(naturalHeight * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không hỗ trợ HTML5 Canvas.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Xuất ra định dạng JPEG chất lượng tối ưu
  let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
  let base64Data = compressedDataUrl.split(",")[1];
  let approxBytes = Math.round((base64Data.length * 3) / 4);

  // Nếu vẫn > 350KB, nén thêm một bước nhẹ ở quality 0.65
  if (approxBytes > 350 * 1024) {
    compressedDataUrl = canvas.toDataURL("image/jpeg", 0.65);
    base64Data = compressedDataUrl.split(",")[1];
    approxBytes = Math.round((base64Data.length * 3) / 4);
  }

  return {
    base64: base64Data,
    mimeType: "image/jpeg",
    previewUrl: compressedDataUrl,
    sizeKb: Math.round(approxBytes / 1024),
    fileName: (file.name ? file.name.replace(/\.[^/.]+$/, "") : "image") + ".jpg",
    skippedCompression: false,
  };
}
