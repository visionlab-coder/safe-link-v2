"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, Share2, X } from "lucide-react";
import { EXPORT_PREVIEW_TEXT } from "@/lib/export-preview-ui";
import type { ExportFile } from "@/utils/export-files";

export default function ExportPreview({ file, language, onClose }: {
  file: ExportFile; language: string; onClose: () => void;
}) {
  const [title, download, share, close, help, shareError] = EXPORT_PREVIEW_TEXT[language] ?? EXPORT_PREVIEW_TEXT.en;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const requestedRef = useRef(false);
  const [url, setUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const headingId = useId();
  const helpId = useId();
  const shareFile = useMemo(() => new File([file.blob], file.filename, { type: file.blob.type }), [file]);
  const canShare = useMemo(() => {
    try { return !!navigator.share && !!navigator.canShare?.({ files: [shareFile] }); }
    catch { return false; }
  }, [shareFile]);
  const preview = useMemo(() => file.previewHtml.replace("<head>", '<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">'), [file]);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file.blob);
    setUrl(objectUrl);
    const dialog = dialogRef.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      // Keep the source alive while Safari consumes an in-flight download.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    };
  }, [file]);

  useEffect(() => {
    if (!url || requestedRef.current) return;
    requestedRef.current = true;
    // Best effort only: browser settings may require a second real tap. Keep
    // this same visible link + generated file available; never claim "saved".
    try { downloadRef.current?.click(); } catch { /* The visible link remains. */ }
  }, [url]);

  const shareToDevice = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    setFailed(false);
    try {
      // Do not await rendering/fetching before share: Safari needs the tap's
      // transient activation. File bytes were prepared before this button.
      await navigator.share({ files: [shareFile] });
    } catch (error) {
      if (!((error instanceof Error || error instanceof DOMException) && error.name === "AbortError")) setFailed(true);
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  };

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby={headingId} aria-describedby={helpId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      dir={language === "ar" ? "rtl" : "ltr"}
      className="fixed inset-0 m-auto h-[calc(100dvh-1rem)] max-h-[900px] w-[calc(100%-1rem)] max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 p-4">
          <FileText aria-hidden className="mt-1 h-6 w-6 shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1"><h2 id={headingId} className="text-lg font-bold">{title}</h2><p className="mt-1 break-all text-sm text-slate-500">{file.filename}</p></div>
          <button type="button" onClick={onClose} aria-label={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"><X aria-hidden className="h-5 w-5" /></button>
        </header>
        <div className="shrink-0 border-b border-slate-200 bg-blue-50 p-4">
          <div className="flex flex-wrap gap-2">
            {/* Keep this preview available if a browser opens, rather than saves, the file. */}
            <a ref={downloadRef} href={url || undefined} download={file.filename} target="_blank" rel="noopener noreferrer" aria-disabled={!url}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold !text-white no-underline">
              <Download aria-hidden className="h-4 w-4" />{download}
            </a>
            {canShare && <button type="button" disabled={sharing} onClick={() => void shareToDevice()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-800 disabled:opacity-50">
              <Share2 aria-hidden className="h-4 w-4" />{share}
            </button>}
          </div>
          <p id={helpId} className="mt-3 text-sm leading-relaxed text-slate-600">{help}</p>
          {failed && <p role="alert" className="mt-2 text-sm text-red-700">{shareError}</p>}
        </div>
        <iframe title={title} srcDoc={preview} sandbox="" className="min-h-0 w-full flex-1 border-0 bg-white" />
      </div>
    </dialog>, document.body,
  );
}
