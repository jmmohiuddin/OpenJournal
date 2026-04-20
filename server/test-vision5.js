import 'dotenv/config';
import { InferenceClient } from '@huggingface/inference';

const hf = new InferenceClient(process.env.HF_TOKEN);
// Create a small image buffer directly
const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function test() {
  try {
    const response = await hf.imageToText({
      model: 'microsoft/trocr-base-printed',
      data: buffer
    });
    console.log("Success TrOCR:", response.generated_text);
  } catch(e) {
    console.error("Failed TrOCR:", e.message);
  }
}
test();
