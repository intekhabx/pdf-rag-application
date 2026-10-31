import { Worker } from 'bullmq';
import redis from '../config/redis.config.js';

import {PDFLoader} from "@langchain/community/document_loaders/fs/pdf";
import splitter from '../config/text-splitter.config.js';
import vectorStore from '../config/qdrant-vector-store.config.js';



type fileParsedData = {
  name: string;
  destination: string;
  path: string;
}


const worker = new Worker('file-upload-queue', async (job) => {

  if(job.name === "add-pdf-docs"){
    console.log("Job-Data: ", job.data);
  }

  const fileData: fileParsedData = JSON.parse(job.data);

  /***
    1. Extract PDF text
    2. Split text into chunks
    3. Generate embeddings
    4. Store embeddings in vector DB
  ***/


  // step:1. PDF se text extract karo (page by page)
  const loader = new PDFLoader(fileData.path);
  const docs = await loader.load();  
  
  if (docs.length === 0) {
    throw new Error("No pages found in PDF.");
  }
  
  console.log(`📑Loaded ${docs.length} pages from PDF.`);


  // step:2. Text ko chunks mein split karo
  //? pdf "docs" jo extract kiye h PDFLoader ke through, woh har page ko alag alag de rha h "docs" array me, woh v pass kr sakte hai embddding ke liye but har page ko v chunk me thod rahe hai

  const chunks = (await splitter.splitDocuments(docs))
    .filter((c) => c.pageContent.length > 0);

  if (chunks.length === 0) {
    throw new Error("No extractable text found in PDF (maybe a scanned PDF).");
  }
  console.log(`📄Extracted ${chunks.length} text chunks from PDF.`);



  // step:3-4. Embeddings generate karo aur vector DB me store kro
  await (await vectorStore).addDocuments(docs);

  console.log("✅Embeddings stored in Qdrant successfully!");


}, {connection: redis, concurrency: 100, });

// concurrency means: how many jobs can be processed simultaneously in a single worker instance



worker.on('ready', () => {
  console.log('Worker is ready and connected to Redis!☑️');
});

worker.on('completed', job => {
  console.log(`🚀JobId: ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`❌JobId: ${job?.id} has failed with ${err.message}`);
});


export default worker;
