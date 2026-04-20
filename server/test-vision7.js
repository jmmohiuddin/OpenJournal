import { InferenceClient } from '@huggingface/inference';

const hf = new InferenceClient(); // no token
const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function test() {
  try {
    const response = await hf.imageToText({
      model: 'Salesforce/blip-image-captioning-large',
      provider: 'hf-inference',
      data: buffer
    });
    console.log("Success Anon BLIP:", response.generated_text);
  } catch(e) {
    console.error("Failed Anon BLIP:", e.message);
  }
}
test();
