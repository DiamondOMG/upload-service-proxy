const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const PORT = 5000; // ⬅️ ใช้ Port 5000 ตามที่คุณทดสอบ

// 1. ตั้งค่า CORS สำหรับการทดสอบ Local Dev
// อนุญาตทุก Origin เพื่อให้ Client Component ของ NextJS คุยได้
app.use(
  cors({
    origin: "*",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-UploadType",
      "X-FileName",
      "X-ItemType",
      "X-PendingId",
      "X-ItemId",
    ],
  })
);

// 2. ตั้งค่า Body Parser ให้รับ Raw Body (Buffer) ขนาดใหญ่
// Type: 'content/unknown' เพื่อให้ตรงกับ Header ของ Client Component
app.use(
  bodyParser.raw({
    type: "content/unknown",
    limit: "100mb", // ⚠️ ตั้ง Limit สูงเพื่อรองรับไฟล์ใหญ่
  })
);

// กำหนด TargetR Endpoint
const TARGETR_UPLOAD_URL = "https://stacks.targetr.net/upload";

// 3. Endpoint สำหรับรับไฟล์จาก Client และส่งต่อ (Proxy) ไป TargetR
app.post("/upload", async (req, res) => {
  // ตรวจสอบว่าได้ Body เป็น Buffer
  if (!req.body || req.body.length === 0) {
    return res.status(400).send("File body is missing or empty.");
  }

  try {
    const fileBuffer = req.body;

    // 4. เตรียม Header สำหรับส่งต่อ Request ไป TargetR
    const targetrHeaders = {
      "X-UploadType": req.header("X-UploadType") || "raw",
      "X-FileName": req.header("X-FileName"),
      "X-ItemType": req.header("X-ItemType") || "libraryitem",
      "Content-Type": req.header("Content-Type") || "content/unknown",
      "X-PendingId": req.header("X-PendingId"),
      "X-ItemId": req.header("X-ItemId"),
      // ⚠️ ต้องเพิ่ม Basic Auth/Credentials ของ TargetR ใน Production
      // "Authorization": "Basic [TargetR Credentials]",
    };

    console.log(
      `[Proxy] Receiving ${fileBuffer.length} bytes. Forwarding to TargetR...`
    );

    // 5. ส่งต่อไฟล์ไปยัง TargetR (ใช้ตัวแปร fetch ที่ require มา)
    const targetrResponse = await fetch(TARGETR_UPLOAD_URL, {
      method: "POST",
      headers: targetrHeaders,
      body: fileBuffer, // ส่ง Buffer ขนาดใหญ่ไป TargetR
    });

    // 6. ส่ง Response กลับไป Client
    const responseText = await targetrResponse.text();
    if (!targetrResponse.ok) {
      console.error("[TargetR Error]:", targetrResponse.status, responseText);
      // ส่งสถานะและข้อความผิดพลาดจาก TargetR กลับไป
      return res
        .status(targetrResponse.status)
        .send(`TargetR Error: ${responseText}`);
    }

    // ส่ง Response ที่สำเร็จจาก TargetR กลับไป
    res.status(200).send(responseText);
  } catch (error) {
    // Log ข้อผิดพลาดของ Proxy เอง (เช่น TypeError: fetch is not a function)
    console.error("EC2 Proxy Error:", error);
    res.status(500).send("Internal Server Error during proxy.");
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Express Upload Proxy listening on http://localhost:${PORT}`);
});
