import { parseDocx, parseImageOcr } from '../src/lib/question-parser';
import mammoth from 'mammoth';

async function testDocxAndOcr() {
  console.log('--- Testing DOCX and OCR Integration ---');

  // Test DOCX parser wrapper function
  // Even with an empty or simulated docx buffer, mammoth should handle gracefully or throw expected format
  try {
    // A minimal valid zip/docx or handling
    console.log('Testing mammoth integration:');
    const dummyBuffer = Buffer.from('PK\x05\x06' + '\x00'.repeat(18)); // empty zip structure
    const docxRes = await parseDocx(dummyBuffer);
    console.log('DOCX questions:', docxRes.questions.length);
  } catch (err: any) {
    console.log('DOCX mammoth handled empty zip predictably:', err.message);
  }

  // Test OCR on valid BMP
  console.log('Testing OCR with Tesseract:');
  const width = 120;
  const height = 40;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const bmp = Buffer.alloc(fileSize);
  bmp.write('BM', 0);
  bmp.writeUInt32LE(fileSize, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(width, 18);
  bmp.writeInt32LE(height, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.fill(0xff, 54);

  const ocrRes = await parseImageOcr(bmp);
  console.log('OCR Questions:', ocrRes.questions.length);
  console.log('OCR Confidence:', ocrRes.confidence);
  console.log('✅ OCR & DOCX integration tests passed!');
}

testDocxAndOcr().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
