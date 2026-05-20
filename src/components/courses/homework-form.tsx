"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface RecentSubmission {
  id: string;
  bodyText: string | null;
  externalUrl: string | null;
  fileKeysCount: number;
  createdAt: string;
}

interface HomeworkFormProps {
  lessonId: string;
  locale: "uk" | "ru";
  recent: RecentSubmission[];
}

interface UploadedFile {
  name: string;
  key: string;
}

async function presignUpload(file: File): Promise<{ url: string; key: string }> {
  const res = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  });
  const json = (await res.json()) as
    | { ok: true; data: { url: string; key: string } }
    | { ok: false; error: { code: string; message: string } };
  if (!json.ok) throw new Error(json.error.message);
  return { url: json.data.url, key: json.data.key };
}

async function uploadOne(file: File): Promise<UploadedFile> {
  const presigned = await presignUpload(file);
  const put = await fetch(presigned.url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error(`upload failed: ${put.status}`);
  return { name: file.name, key: presigned.key };
}

export function HomeworkForm({
  lessonId,
  locale,
  recent,
}: HomeworkFormProps) {
  const t = useTranslations("lesson.homework");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let uploaded: UploadedFile[] = files;
      if (pendingFiles.length > 0) {
        const fresh = await Promise.all(pendingFiles.map(uploadOne));
        uploaded = [...uploaded, ...fresh];
        setFiles(uploaded);
        setPendingFiles([]);
      }
      const res = await fetch("/api/homework/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          bodyText: text || null,
          externalUrl: url || null,
          fileKeys: uploaded.map((f) => f.key),
        }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { id: string } }
        | { ok: false; error: { code: string; message: string } };
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setDone(true);
      setText("");
      setUrl("");
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-foreground/10 bg-muted/30 p-6 sm:p-8">
      <p className="text-xs uppercase tracking-widest text-foreground/55">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 font-display text-2xl">{t("title")}</h2>
      <p className="mt-2 text-sm text-foreground/65">{t("desc")}</p>

      {done ? (
        <div className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
          {t("sent")}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm">
          <span className="text-foreground/70">{t("text")}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={10000}
            className="rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base text-foreground placeholder:text-foreground/40 focus:border-foreground focus:outline-none"
            placeholder={t("textPlaceholder")}
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-foreground/70">{t("link")}</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={500}
            placeholder="https://"
            className="h-12 rounded-2xl border border-foreground/20 bg-background/60 px-4 text-base text-foreground placeholder:text-foreground/40 focus:border-foreground focus:outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-foreground/70">{t("files")}</span>
          <input
            type="file"
            multiple
            onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))}
            className="text-sm text-foreground/70"
          />
        </label>
        {pendingFiles.length > 0 ? (
          <p className="text-xs text-foreground/55">
            {t("pendingCount", { n: pendingFiles.length })}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>

      {recent.length > 0 ? (
        <div className="mt-10 border-t border-foreground/10 pt-6">
          <p className="text-xs uppercase tracking-widest text-foreground/55">
            {t("recent")}
          </p>
          <ul className="mt-4 grid gap-3 text-sm">
            {recent.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-foreground/10 bg-background/40 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-widest text-foreground/45">
                  {new Date(r.createdAt).toLocaleString(
                    locale === "ru" ? "ru-RU" : "uk-UA",
                    { dateStyle: "medium", timeStyle: "short" }
                  )}
                  {r.fileKeysCount > 0
                    ? ` · ${t("filesCount", { n: r.fileKeysCount })}`
                    : ""}
                </p>
                {r.bodyText ? (
                  <p className="mt-2 whitespace-pre-line text-foreground/80">
                    {r.bodyText.length > 280
                      ? `${r.bodyText.slice(0, 280)}…`
                      : r.bodyText}
                  </p>
                ) : null}
                {r.externalUrl ? (
                  <a
                    href={r.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block break-all text-xs text-blue-300 hover:underline"
                  >
                    {r.externalUrl}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
