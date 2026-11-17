import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });

const datasetDirectory = path.join(projectRoot, "dataset");
const supportedExtensions = new Set([".md", ".mdx", ".txt", ".csv", ".json", ".html", ".htm"]);
const chunkSize = 1800;
const chunkOverlap = 220;
const embeddingBatchSize = 16;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing. Add it to .env.local before ingestion.`);
  return value;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.name.startsWith(".")) return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return supportedExtensions.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
  }));
  return nested.flat();
}

function cleanText(filePath, text) {
  if ([".html", ".htm"].includes(path.extname(filePath).toLowerCase())) {
    text = text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<\/(?:p|div|li|h[1-6]|br|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"');
  }
  return text.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function splitIntoChunks(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const paragraph = text.lastIndexOf("\n", end);
      const sentence = text.lastIndexOf(". ", end);
      const boundary = Math.max(paragraph, sentence);
      if (boundary > start + Math.floor(chunkSize * 0.6)) end = boundary + 1;
    }
    const content = text.slice(start, end).trim();
    if (content) chunks.push(content);
    if (end >= text.length) break;
    start = Math.max(end - chunkOverlap, start + 1);
  }
  return chunks;
}

async function embedPassages(texts, apiKey) {
  const response = await fetch("https://api.upstage.ai/v1/solar/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.UPSTAGE_PASSAGE_MODEL || "solar-embedding-2-passage",
      input: texts,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Upstage embedding failed (${response.status}): ${details.slice(0, 500)}`);
  }

  const payload = await response.json();
  const data = payload.data;
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error("Upstage returned an incomplete embedding batch.");
  }
  return data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

async function removeMissingSources(supabase, currentSources) {
  const existingSources = new Set();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("documents")
      .select("source_path")
      .order("source_path")
      .range(offset, offset + 999);
    if (error) throw new Error(`Could not list indexed documents: ${error.message}`);

    for (const row of data ?? []) existingSources.add(row.source_path);
    if (!data || data.length < 1000) break;
    offset += data.length;
  }

  for (const sourcePath of existingSources) {
    if (currentSources.has(sourcePath)) continue;
    const { error } = await supabase.from("documents").delete().eq("source_path", sourcePath);
    if (error) throw new Error(`Could not remove deleted source ${sourcePath}: ${error.message}`);
    console.log(`Removed deleted source ${sourcePath}`);
  }
}

async function main() {
  const files = await listFiles(datasetDirectory);
  if (!files.length) {
    console.log("No supported documents found in dataset/. Add .md, .mdx, .txt, .csv, .json, or .html files first.");
    return;
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseSecretKey) {
    throw new Error("Set SUPABASE_SECRET_KEY in .env.local. Never expose this key with a NEXT_PUBLIC_ prefix.");
  }
  const upstageKey = requiredEnv("UPSTAGE_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const currentSources = new Set(files.map((filePath) => path.relative(datasetDirectory, filePath).split(path.sep).join("/")));
  await removeMissingSources(supabase, currentSources);

  let indexedChunks = 0;
  for (const filePath of files) {
    const relativePath = path.relative(datasetDirectory, filePath).split(path.sep).join("/");
    const rawText = await readFile(filePath, "utf8");
    const text = cleanText(filePath, rawText);
    if (!text) continue;

    const firstHeading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const title = firstHeading || path.basename(filePath, path.extname(filePath));
    const chunks = splitIntoChunks(text);

    for (let offset = 0; offset < chunks.length; offset += embeddingBatchSize) {
      const batch = chunks.slice(offset, offset + embeddingBatchSize);
      const embeddings = await embedPassages(batch, upstageKey);
      const rows = batch.map((content, batchIndex) => ({
        source_path: relativePath,
        title,
        chunk_index: offset + batchIndex,
        content,
        embedding: embeddings[batchIndex],
        metadata: { extension: path.extname(filePath).toLowerCase() },
      }));

      const { error } = await supabase
        .from("documents")
        .upsert(rows, { onConflict: "source_path,chunk_index" });
      if (error) throw new Error(`Could not save ${relativePath}: ${error.message}`);
      indexedChunks += rows.length;
    }

    const { error: staleChunkError } = await supabase
      .from("documents")
      .delete()
      .eq("source_path", relativePath)
      .gte("chunk_index", chunks.length);
    if (staleChunkError) throw new Error(`Could not remove stale chunks for ${relativePath}: ${staleChunkError.message}`);

    console.log(`Indexed ${relativePath} (${chunks.length} chunks)`);
  }

  console.log(`Done. Upserted ${indexedChunks} document chunks into Supabase.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
