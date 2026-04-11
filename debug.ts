#!/usr/bin/env bun
import { createHash } from "node:crypto";

const APP_ID = "AKfycbwJCxfeaEzixLFiMU33eFooZRq4yoqTx6eFPkKggsq1Yt6q7FceOoF-MMhS-3SUT42Taw";
const BASE_URL = `https://script.google.com/macros/s/${APP_ID}/exec`;
const CALLBACK = "__cb__";

// ---------- Utility Functions ----------

function md5Base64Url(str: string) {
  return createHash("md5")
    .update(str, "utf8")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function splitString(str: string, chunkSize: number) {
  const chunks = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
}

function parseJsonp(text: string) {
  const s = text.trim();
  const prefix = `${CALLBACK}(`;
  const suffix = `)`;

  if (!s.startsWith(prefix) || !s.endsWith(suffix)) {
    throw new Error(
      "Response is not the expected JSONP format. Possible causes:\n" +
        "1) Web App is not properly deployed\n" +
        "2) Access permission is not set to 'Anyone'\n" +
        "3) URL does not end with /exec\n\n" +
        "First 500 characters of raw response:\n" +
        s.slice(0, 500),
    );
  }

  const json = s.slice(prefix.length, -suffix.length);
  return JSON.parse(json);
}

async function callGas(params: Record<string, unknown>) {
  const url = new URL(BASE_URL);

  url.searchParams.set("callback", CALLBACK);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  console.log(
    `\n[Request] ${url.toString().slice(0, 220)}${url.toString().length > 220 ? "..." : ""}`,
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
  });

  const text = await res.text();

  console.log(`[HTTP ${res.status}]`);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}\n${text.slice(0, 500)}`);
  }

  return parseJsonp(text);
}

// ---------- Direct Write ----------

async function directWrite(sheet: string, rows: unknown) {
  return await callGas({
    action: "write",
    sheet,
    rows: JSON.stringify(rows),
  });
}

// ---------- Chunked Write ----------

async function chunkWrite(sheet: string, rows: unknown, chunkSize = 300) {
  const fullStr = JSON.stringify(rows);
  const chunks = splitString(fullStr, chunkSize);
  const sessionId = `bun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dataHash = md5Base64Url(fullStr);

  console.log(`sessionId   = ${sessionId}`);
  console.log(`totalChunks = ${chunks.length}`);
  console.log(`dataHash    = ${dataHash}`);

  let lastResult = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunkData = Buffer.from(chunks[i], "utf8").toString("base64");

    lastResult = await callGas({
      action: "chunk",
      sheet,
      sessionId,
      totalChunks: chunks.length,
      chunkIndex: i,
      chunkData,
      dataHash,
    });

    console.log(`[Chunk ${i + 1}/${chunks.length}]`, lastResult);
  }

  return lastResult;
}

// ---------- Main Process ----------

async function main() {
  const participantId = `P_${Date.now()}`;
  const trialId = `T_${Date.now()}`;

  // 1) trials test data
  const trialsRows = [
    [participantId, trialId, "article", "L1-R2", "A>B>C>D", 1534, 2],
    [participantId, `${trialId}_2`, "video", "R1-L2", "D>C>B>A", 1820, 0],
  ];

  // 2) device test data
  const deviceRows = [[participantId, 344.5, 194.2, 18.0, 12.0, "TEST USER AGENT"]];

  // 3) keypresses test data
  const keypressRows = Array.from({ length: 24 }, (_, i) => {
    const expected = ["A", "S", "D", "F"][i % 4];
    const isBackspace = i % 7 === 6;
    const pressed = isBackspace ? "Backspace" : expected;
    const action = isBackspace ? "backspace" : "keypress";
    const status = isBackspace ? "backspace" : "correct";

    return [
      participantId, // Participant_ID
      trialId, // Trial_ID
      i * 120, // Timestamp_ms
      i === 0 ? 0 : 120, // Interval_ms
      action, // Action
      "physical_keyboard", // Input_Method
      `slot_${(i % 4) + 1}`, // Slot_ID
      pressed, // Pressed_Key
      isBackspace ? "" : expected, // Expected_Key
      status, // Status
    ];
  });

  console.log("==================================================");
  console.log("1) Test trials direct write");
  console.log("==================================================");
  const r1 = await directWrite("trials", trialsRows);
  console.log("Result:", r1);

  console.log("\n==================================================");
  console.log("2) Test device direct write");
  console.log("==================================================");
  const r2 = await directWrite("device", deviceRows);
  console.log("Result:", r2);

  console.log("\n==================================================");
  console.log("3) Test keypresses chunked write");
  console.log("==================================================");
  const r3 = await chunkWrite("keypresses", keypressRows, 200);
  console.log("Final Result:", r3);

  console.log("\nAll requests have been sent.");
  console.log("Please open the Spreadsheet to verify that all three sheets were written successfully.");
  console.log(`participantId = ${participantId}`);
  console.log(`trialId       = ${trialId}`);
}

main().catch((err) => {
  console.error("\nTest failed:");
  console.error(err);
  process.exit(1);
});
