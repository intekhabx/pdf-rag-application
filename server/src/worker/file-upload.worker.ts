import { Worker } from 'bullmq';
import redis from '../config/redis.config.js';

import {PDFLoader} from "@langchain/community/document_loaders/fs/pdf";
// import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
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


  // 1. PDF se text extract karo (page by page)
  const loader = new PDFLoader(fileData.path);
  const docs = await loader.load();
  // console.log(docs);


  // 2. Text ko chunks mein split karo
  // const splitter = new RecursiveCharacterTextSplitter({
  //   chunkSize: 1000,
  //   chunkOverlap: 200
  // });
  // const chunks = await splitter.splitDocuments(docs);
  // console.log(chunks);
  //! pdf "docs" jo extract h kiye PDFLoader ke through, woh already har page ko alag alag de rha h "docs" array me, to mai ek page ko aur chote-chote tukde me todna nhi chahta
  //? is liye mai textSplitter ka use nhi kr rha hun


  // 3-4. Embeddings generate karo aur vector DB me store kro
  (await vectorStore).addDocuments(docs);

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
