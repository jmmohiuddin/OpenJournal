import 'dotenv/config';
import fs from 'fs';

const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function test() {
  try {
    const payload = {
      model: "Qwen/Qwen2-VL-7B-Instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this image?" },
            { type: "image_url", image_url: { url: dataUri } }
          ]
        }
      ],
      max_tokens: 10
    };

    const res = await fetch("https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-7B-Instruct/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log("Success fetch:", JSON.stringify(result));
  } catch(e) {
    console.error("Failed fetch:", e.message);
  }
}
test();
