import { InferenceClient } from '@huggingface/inference';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const hf = new InferenceClient(process.env.HF_TOKEN);
const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function test() {
  try {
    const response = await hf.chatCompletion({
      model: 'Qwen/Qwen2-VL-7B-Instruct',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'What is this?' }, { type: 'image_url', image_url: { url: dataUri } }] }],
      max_tokens: 10
    });
    console.log("Success Qwen2-VL:", response.choices[0].message.content);
  } catch(e) {
    console.error("Qwen2-VL Failed:", e.message);
  }
}
test();
