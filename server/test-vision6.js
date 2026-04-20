import 'dotenv/config';
import { InferenceClient } from '@huggingface/inference';

const hf = new InferenceClient(process.env.HF_TOKEN);
const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function test() {
  try {
    const response = await hf.imageToText({
      model: 'Salesforce/blip-image-captioning-large',
      data: buffer
    });
    console.log("Success BLIP:", response.generated_text);
  } catch(e) {
    console.error("Failed BLIP:", e.message);
  }
}
test();
