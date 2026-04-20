import 'dotenv/config';
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: "https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-7B-Instruct/v1",
  apiKey: process.env.HF_TOKEN
});

const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function test() {
  try {
    const response = await client.chat.completions.create({
      model: 'Qwen/Qwen2-VL-7B-Instruct',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'what is this image?' }, { type: 'image_url', image_url: { url: dataUri } }] }],
      max_tokens: 10
    });
    console.log("Success Qwen:", response.choices[0].message.content);
  } catch(e) {
    console.error("Failed Qwen:", e.message);
  }
}
test();
