import { z } from "zod";
import { API_V1 } from "./config";
import { getApiAuthHeaders, ApiClientError, apiErrorSchema } from "./api-client";

export const pendingAttachmentSchema = z.object({
  fileId: z.string(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  scanStatus: z.string(),
});

export type PendingAttachment = z.infer<typeof pendingAttachmentSchema>;

export const attachmentMetadataSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  fileId: z.string(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  inline: z.boolean(),
  contentId: z.string().nullish(),
  scanStatus: z.string(),
});

export type AttachmentMetadata = z.infer<typeof attachmentMetadataSchema>;

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export async function listMessageAttachments(messageId: string): Promise<AttachmentMetadata[]> {
  const res = await fetch(
    `${API_V1}/oneops/mailbox/attachments?messageId=${messageId}`,
    { headers: getApiAuthHeaders({ Accept: "application/json" }), credentials: "include" },
  );
  if (!res.ok) throw await parseDownloadError(res);
  const json: unknown = await res.json();
  return z.array(attachmentMetadataSchema).parse(json);
}

export function uploadMailAttachment(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<PendingAttachment> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_V1}/oneops/mailbox/attachments`);
    const headers = getApiAuthHeaders();
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.responseType = "json";
    if (signal) {
      signal.addEventListener("abort", () => xhr.abort());
    }
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(pendingAttachmentSchema.parse(xhr.response));
        } catch (err) {
          reject(err);
        }
        return;
      }
      reject(new ApiClientError(xhr.status, { code: "UPLOAD_FAILED", message: "Upload failed" }));
    };
    xhr.onerror = () =>
      reject(new ApiClientError(0, { code: "NETWORK", message: "Upload failed" }));
    xhr.onabort = () =>
      reject(new ApiClientError(0, { code: "ABORTED", message: "Upload cancelled" }));

    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

export async function describePendingAttachment(fileId: string): Promise<PendingAttachment> {
  const res = await fetch(
    `${API_V1}/oneops/mailbox/attachments/pending?fileId=${fileId}`,
    { headers: getApiAuthHeaders({ Accept: "application/json" }), credentials: "include" },
  );
  if (!res.ok) throw await parseDownloadError(res);
  const json: unknown = await res.json();
  return pendingAttachmentSchema.parse(json);
}

export async function resolveDraftAttachmentRows(
  fileIds: string[],
): Promise<{ fileId: string; filename: string; sizeBytes: number }[]> {
  const settled = await Promise.allSettled(fileIds.map((fileId) => describePendingAttachment(fileId)));
  return settled.map((result, index) => {
    const fileId = fileIds[index]!;
    if (result.status === "fulfilled") {
      return {
        fileId: result.value.fileId,
        filename: result.value.filename,
        sizeBytes: result.value.sizeBytes,
      };
    }
    return { fileId, filename: "Attachment", sizeBytes: 0 };
  });
}

export async function deletePendingAttachment(fileId: string): Promise<void> {
  const res = await fetch(`${API_V1}/oneops/mailbox/attachments?fileId=${fileId}`, {
    method: "DELETE",
    headers: getApiAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) throw await parseDownloadError(res);
}

export async function downloadMailAttachment(options: {
  attachmentId?: string;
  fileId?: string;
  filename: string;
}): Promise<void> {
  const param = options.attachmentId
    ? `attachmentId=${options.attachmentId}`
    : `fileId=${options.fileId}`;
  const res = await fetch(`${API_V1}/oneops/mailbox/attachments?${param}`, {
    headers: getApiAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw await parseDownloadError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.filename || "download";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function parseDownloadError(response: Response): Promise<ApiClientError> {
  try {
    const json: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) return new ApiClientError(response.status, parsed.data);
  } catch {
    // fall through
  }
  return new ApiClientError(response.status, {
    code: "UNKNOWN",
    message: response.statusText || "Request failed",
  });
}
