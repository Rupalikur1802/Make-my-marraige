"use client";
/* Native image elements intentionally use authenticated, no-store application URLs.
   Next image optimization would cache private wedding media across sessions. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MAX_PHOTO_BYTES,
  type GalleryDTO,
  type PhotoDTO,
} from "@/modules/photos/validation";
import styles from "./photos.module.css";
type FileItem = {
  key: string;
  file: File;
  preview: string;
  status: string;
  progress: number;
  failed: boolean;
  done: boolean;
  providerSent: boolean;
  photoId?: string;
};
class RequestError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (r.status === 204) return undefined as T;
  const body = await r.json().catch(() => null);
  if (!r.ok)
    throw new RequestError(
      body?.error?.message ?? "The request failed. Please try again.",
      body?.error?.code ?? "UNAVAILABLE",
    );
  return body.data as T;
}
function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wide ? styles.viewer : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className={styles.modalHeading}>
        <h2>{title}</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function sendFile(
  endpoint: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (n: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest(),
      body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.append(k, v);
    body.append("file", file);
    xhr.open("POST", endpoint);
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            "Upload could not finish. Retry to check or resume this photo.",
          ),
        );
    };
    xhr.onerror = xhr.ontimeout = () =>
      reject(
        new Error(
          "Connection interrupted. Retry to check or resume this photo.",
        ),
      );
    xhr.send(body);
  });
}
export function PhotoGallery({
  guest = false,
  initial,
  initialError = "",
  initialCode = "",
}: {
  guest?: boolean;
  initial?: GalleryDTO;
  initialError?: string;
  initialCode?: string;
}) {
  const base = guest ? "/api/guest/photos" : "/api/photos";
  const [data, setData] = useState<GalleryDTO | undefined>(initial),
    [error, setError] = useState(initialError),
    [code, setCode] = useState(initialCode),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [uploadOpen, setUploadOpen] = useState(false),
    [queue, setQueue] = useState<FileItem[]>([]),
    [selectionError, setSelectionError] = useState(""),
    [uploading, setUploading] = useState(false),
    [viewId, setViewId] = useState<string | null>(null),
    [deleting, setDeleting] = useState<PhotoDTO | null>(null),
    [deleteBusy, setDeleteBusy] = useState(false),
    [deleteError, setDeleteError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    uploadsBusy = useRef(false),
    refreshBusy = useRef(false),
    previews = useRef(new Set<string>());
  const revoked =
    guest &&
    [
      "PHOTO_ACCESS_PAUSED",
      "UNAUTHENTICATED",
      "INVITATION_UNAVAILABLE",
    ].includes(code);
  const fail = useCallback(
    (e: unknown) => {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn’t load the photos. Please try again.",
      );
      const c = e instanceof RequestError ? e.code : "UNAVAILABLE";
      setCode(c);
      if (guest) {
        setData(undefined);
        setViewId(null);
      }
    },
    [guest],
  );
  const refresh = useCallback(
    async (more = false, before?: string | null) => {
      if (refreshBusy.current) return;
      refreshBusy.current = true;
      setLoading(true);
      try {
        const next = await request<GalleryDTO>(
          base + (more && before ? "?before=" + before : ""),
        );
        setData((old) =>
          more && old
            ? {
                ...next,
                photos: [
                  ...old.photos,
                  ...next.photos.filter(
                    (p) => !old.photos.some((o) => o.id === p.id),
                  ),
                ],
              }
            : next,
        );
        setError("");
        setCode("");
      } catch (e) {
        fail(e);
      } finally {
        refreshBusy.current = false;
        setLoading(false);
      }
    },
    [base, fail],
  );
  useEffect(() => {
    if (!guest) return;
    const check = () => {
      if (document.visibilityState === "visible" && !uploadsBusy.current)
        void refresh();
    };
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [guest, refresh]);
  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, []);
  function choose(files: FileList | File[] | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (selected.length + queue.length > 10) {
      setSelectionError("Select up to 10 photos at a time.");
      return;
    }
    setSelectionError("");
    setQueue((old) => [
      ...old,
      ...selected.map((file) => {
        const valid =
          ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
          file.size > 0 &&
          file.size <= MAX_PHOTO_BYTES;
        const preview = valid ? URL.createObjectURL(file) : "";
        if (preview) previews.current.add(preview);
        return {
          key: crypto.randomUUID(),
          file,
          preview,
          status: !file.size
            ? "This file is empty."
            : file.size > MAX_PHOTO_BYTES
              ? "This photo is larger than 10 MB."
              : !valid
                ? "Choose a JPEG, PNG or WebP image."
                : "Waiting",
          progress: 0,
          failed: !valid,
          done: false,
          providerSent: false,
        };
      }),
    ]);
    if (fileInput.current) fileInput.current.value = "";
  }
  function update(key: string, patch: Partial<FileItem>) {
    setQueue((old) => old.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }
  async function upload(onlyKey?: string) {
    if (uploadsBusy.current) return;
    uploadsBusy.current = true;
    setUploading(true);
    for (const q of queue) {
      if (q.done || !q.preview || (onlyKey && q.key !== onlyKey)) continue;
      let providerSent = q.providerSent;
      try {
        update(q.key, { status: "Preparing upload", failed: false });
        const ticket = await request<{
          id: string;
          ready: boolean;
          endpoint?: string;
          fields?: Record<string, string>;
        }>(base + "/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: q.file.name,
            size: q.file.size,
            contentType: q.file.type,
            requestKey: q.key,
          }),
        });
        update(q.key, { photoId: ticket.id });
        if (!ticket.ready) {
          if (!providerSent) {
            update(q.key, { status: "Uploading", progress: 0 });
            try {
              await sendFile(ticket.endpoint!, ticket.fields!, q.file, (n) =>
                update(q.key, { progress: n }),
              );
            } finally {
              providerSent = true;
              update(q.key, { providerSent: true });
            }
          }
          update(q.key, { status: "Checking photo", progress: 100 });
          await request(base + "/" + ticket.id + "/complete", {
            method: "POST",
          });
        }
        update(q.key, {
          status: "Added to gallery",
          done: true,
          failed: false,
          progress: 100,
        });
      } catch (e) {
        update(q.key, {
          status:
            e instanceof Error ? e.message : "Upload failed. Please try again.",
          failed: true,
          providerSent: false,
        });
        if (
          e instanceof RequestError &&
          [
            "PHOTO_ACCESS_PAUSED",
            "UNAUTHENTICATED",
            "INVITATION_UNAVAILABLE",
          ].includes(e.code)
        ) {
          fail(e);
          break;
        }
      }
    }
    uploadsBusy.current = false;
    setUploading(false);
    await refresh();
  }
  function closeUpload() {
    if (uploadsBusy.current) return;
    setUploadOpen(false);
    setSelectionError("");
    for (const q of queue)
      if (q.preview) {
        URL.revokeObjectURL(q.preview);
        previews.current.delete(q.preview);
      }
    setQueue([]);
  }
  async function toggle() {
    if (!data || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const result = await request<{
        guestAccess: boolean;
        settingsVersion: number;
      }>(base + "/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestAccess: !data.guestAccess,
          expectedVersion: data.settingsVersion,
        }),
      });
      setData({ ...data, ...result });
      setSaved(true);
      setError("");
      setCode("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Access setting could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }
  const viewIndex = data?.photos.findIndex((p) => p.id === viewId) ?? -1,
    viewPhoto = data?.photos[viewIndex];
  async function remove() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await request(base + "/" + deleting.id, { method: "DELETE" });
      setDeleting(null);
      await refresh();
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Deletion failed. Please retry.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }
  const imageUrl = (p: PhotoDTO, large = false) =>
    base + "/" + p.id + "/media?size=" + (large ? "large" : "thumbnail");
  return (
    <div className={styles.main}>
      {guest && (
        <Link className={styles.back} href="/guest">
          ← Back to invitation
        </Link>
      )}
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>
            Candid chronicles &amp; family heirlooms
          </p>
          <h1>{guest ? "Wedding memories" : "Wedding photos"}</h1>
          <p>
            {guest
              ? "Enjoy the moments and share the photos you captured."
              : "All your wedding memories, shared in one place."}
          </p>
        </div>
        {data && !revoked && (
          <button
            className={styles.primary}
            onClick={() => setUploadOpen(true)}
          >
            ↑ Upload photos
          </button>
        )}
      </header>
      {!guest && data && (
        <section className={styles.access}>
          <div>
            <h2>
              Allow guest photo access{" "}
              {saved && <span className={styles.saved}>Saved</span>}
            </h2>
            <p>
              {data.guestAccess
                ? "Invited guests can view and upload wedding photos."
                : "Guest access is paused. Your photos remain saved and available to you."}
            </p>
            <small>
              Photos already downloaded by guests cannot be recalled.
            </small>
          </div>
          <button
            role="switch"
            aria-checked={data.guestAccess}
            aria-label="Allow guest photo access"
            className={styles.switch}
            disabled={saving}
            onClick={toggle}
          >
            <span />
          </button>
          {saving && <span role="status">Saving…</span>}
        </section>
      )}
      {error && (
        <section className={styles.notice} role="alert">
          <h2>
            {revoked
              ? code === "PHOTO_ACCESS_PAUSED"
                ? "Photo sharing is currently closed"
                : "Invitation link needed"
              : "Unable to load photos"}
          </h2>
          <p>{error}</p>
          {code === "UNAUTHENTICATED" && (
            <p>Reopen the current invitation link from your email.</p>
          )}
          <button disabled={loading} onClick={() => void refresh()}>
            {loading ? "Loading…" : "Try again"}
          </button>
          {guest && <Link href="/guest">Back to invitation</Link>}
        </section>
      )}
      {data && !revoked && (
        <>
          {!data.photos.length ? (
            <section className={styles.empty}>
              <span aria-hidden="true">▧</span>
              <h2>
                {guest
                  ? "Be the first to share a memory."
                  : "Your wedding memories start here."}
              </h2>
              <p>
                {guest
                  ? "Share the moments you captured."
                  : "Upload your first photos, or let your guests share theirs."}
              </p>
              <button
                className={styles.primary}
                onClick={() => setUploadOpen(true)}
              >
                Upload photos
              </button>
            </section>
          ) : (
            <div className={styles.grid}>
              {data.photos.map((p) => (
                <article key={p.id} className={styles.photo}>
                  <button
                    className={styles.photoButton}
                    onClick={() => setViewId(p.id)}
                    aria-label={"View " + p.filename}
                  >
                    <img
                      src={imageUrl(p)}
                      alt={p.filename}
                      loading="lazy"
                      width={600}
                      height={600}
                      onError={(e) => {
                        e.currentTarget.hidden = true;
                      }}
                    />
                    <span>View photo</span>
                  </button>
                  <div className={styles.caption}>
                    <div>
                      <h2>{p.filename}</h2>
                      <p>
                        {new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "medium",
                          timeZone: "Asia/Kolkata",
                        }).format(new Date(p.createdAt))}{" "}
                        · {p.uploadedBy}
                      </p>
                    </div>
                    {!guest && (
                      <button
                        onClick={() => {
                          setDeleteError("");
                          setDeleting(p);
                        }}
                        aria-label={"Delete " + p.filename}
                      >
                        ⋮
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className={styles.footer}>
            {data.nextCursor && (
              <button
                disabled={loading}
                onClick={() => void refresh(true, data.nextCursor)}
              >
                {loading ? "Loading…" : "Load more photos"}
              </button>
            )}
            <button disabled={loading} onClick={() => void refresh()}>
              {loading ? "Refreshing…" : "Refresh gallery"}
            </button>
          </div>
        </>
      )}
      {uploadOpen && (
        <Modal
          title="Upload wedding photos"
          onClose={closeUpload}
          busy={uploading}
        >
          {revoked ? (
            <p role="alert">
              Guest photo access is unavailable. Your completed photos remain
              saved.
            </p>
          ) : (
            <>
              <div
                className={styles.drop}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!uploading) choose(e.dataTransfer.files);
                }}
              >
                <span aria-hidden="true">↑</span>
                <p>Share the moments worth remembering.</p>
                <button
                  disabled={uploading || queue.length >= 10}
                  onClick={() => fileInput.current?.click()}
                >
                  Choose photos
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => choose(e.target.files)}
                />
                <small>
                  JPEG, PNG or WebP. Up to 10 MB per photo.
                  <br />
                  Select up to 10 photos at a time.
                </small>
              </div>
              {selectionError && <p role="alert">{selectionError}</p>}
              <ul className={styles.queue}>
                {queue.map((q) => (
                  <li key={q.key}>
                    {q.preview && (
                      <img
                        src={q.preview}
                        width={56}
                        height={56}
                        alt="Selected photo preview"
                      />
                    )}
                    <div>
                      <strong>{q.file.name}</strong>
                      <small>
                        {(q.file.size / (1024 * 1024)).toFixed(2)} MB
                      </small>
                      <p role="status">{q.status}</p>
                      {q.status === "Uploading" && (
                        <progress
                          aria-label={"Uploading " + q.file.name}
                          value={q.progress}
                          max={100}
                        />
                      )}
                      {q.failed && q.preview && !q.done && !revoked && (
                        <button
                          disabled={uploading}
                          aria-label={"Retry " + q.file.name}
                          onClick={() => void upload(q.key)}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                    {!uploading && !q.done && (
                      <button
                        aria-label={"Remove " + q.file.name}
                        onClick={() => {
                          if (q.preview) {
                            URL.revokeObjectURL(q.preview);
                            previews.current.delete(q.preview);
                          }
                          setQueue((old) => old.filter((f) => f.key !== q.key));
                        }}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className={styles.help}>
                Photos appear after automatic checks. Uploading may resize
                images and removes embedded metadata. Keep your original files
                separately.
              </p>
            </>
          )}
          <div className={styles.actions}>
            <button disabled={uploading} onClick={closeUpload}>
              {queue.some((q) => q.done) ? "Done" : "Cancel"}
            </button>
            {!revoked && (
              <button
                className={styles.primary}
                disabled={uploading || !queue.some((q) => !q.done && q.preview)}
                onClick={() => void upload()}
              >
                {uploading
                  ? "Uploading…"
                  : queue.some((q) => q.failed && q.preview)
                    ? "Retry unfinished photos"
                    : "Upload photos"}
              </button>
            )}
          </div>
        </Modal>
      )}
      {viewPhoto && !revoked && (
        <Modal title="Wedding memory" wide onClose={() => setViewId(null)}>
          <div className={styles.viewerImage}>
            <img src={imageUrl(viewPhoto, true)} alt={viewPhoto.filename} />
          </div>
          <div className={styles.viewerActions}>
            <button
              disabled={viewIndex <= 0}
              onClick={() => setViewId(data!.photos[viewIndex - 1]!.id)}
            >
              ← Previous
            </button>
            <p>
              {viewIndex + 1} of {data!.photos.length}
              {data!.nextCursor ? " loaded" : ""}
            </p>
            <button
              disabled={viewIndex >= data!.photos.length - 1}
              onClick={() => setViewId(data!.photos[viewIndex + 1]!.id)}
            >
              Next →
            </button>
          </div>
          <p>{viewPhoto.filename}</p>
          {!guest && (
            <button
              className={styles.danger}
              onClick={() => {
                setViewId(null);
                setDeleteError("");
                setDeleting(viewPhoto);
              }}
            >
              Delete photo
            </button>
          )}
        </Modal>
      )}
      {deleting && !guest && (
        <Modal
          title="Delete this photo?"
          busy={deleteBusy}
          onClose={() => setDeleting(null)}
        >
          <img
            className={styles.deletePreview}
            src={imageUrl(deleting)}
            alt={deleting.filename}
          />
          <p>
            This removes the photo from your wedding gallery for everyone. This
            cannot be undone.
          </p>
          {deleteError && <p role="alert">{deleteError}</p>}
          <div className={styles.actions}>
            <button disabled={deleteBusy} onClick={() => setDeleting(null)}>
              Keep photo
            </button>
            <button
              className={styles.danger}
              disabled={deleteBusy}
              onClick={() => void remove()}
            >
              {deleteBusy ? "Deleting…" : "Delete photo"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
