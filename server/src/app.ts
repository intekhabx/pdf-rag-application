import cors from "cors";
import express, {type Express} from "express";
import upload from "./middleware/multer.middleware.js";
import fileUploadQueue from "./queue/file-upload.queue.js";
import "./worker/file-upload.worker.js";
import vectorStore from "./config/qdrant-vector-store.config.js";
import callChatLLM from "./agent/agent.js";
import fs from "node:fs";


export default function expressApplication():Express {
  const app = express();
  
  app.use(express.json());
  app.use(cors({
    origin: ["http://localhost:3000"],
  }))



  // routes
  app.get("/health", (req, res)=> {
    res.json({status: "Server is healthy"});
  })


  app.post("/upload", upload.single("pdf"), async (req, res) => {

    const file = req.file;
    if(!file){
      return res.status(400).json({error: "No file uploaded"});
    }
    console.log("📄 File uploaded on server through multer:", file.originalname);

    // return res.status(202).json({message: "File is uploading...", jobId: "hello123"});

    // adding the file details in the queue
    const data = JSON.stringify({name: file.filename, destination: file.destination, path: file.path});
    const job = await fileUploadQueue.add("add-pdf-docs", data);

    res.status(202).json({message: "File is uploading...", jobId: job.id});
  })


  
  app.get("/upload/:jobId/events", async (req, res) => {
    const job = await fileUploadQueue.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({error: "Upload job not found"});
    }

    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    type UploadStatus = "queued" | "processing" | "completed" | "failed";
    let lastStatus: UploadStatus | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let isClosed = false;

    const sendStatus = (status: UploadStatus, message: string) => {
      if (isClosed) return;
      res.write(`data: ${JSON.stringify({status, message})}\n\n`);
      lastStatus = status;
    };

    const pollJob = async () => {
      if (isClosed) return;

      try {
        const state = await job.getState();
        if (isClosed) return;

        let status: UploadStatus = "queued";
        let message = "PDF uploaded and waiting for processing.";

        if (state === "active") {
          status = "processing";
          message = "PDF uploaded. Processing is in progress...";
        } else if (state === "completed") {
          status = "completed";
          message = "PDF uploaded and processed successfully.";
        } else if (state === "failed") {
          status = "failed";
          message = "PDF processing failed. Please try again.";
        }

        if (status !== lastStatus) {
          sendStatus(status, message);
        }

        if (status === "completed" || status === "failed") {
          res.end();
          return;
        }
      } catch (error) {
        console.error(`Failed to read upload job ${job.id} status:`, error);
        sendStatus("failed", "Unable to retrieve PDF processing status.");
        res.end();
        return;
      }

      pollTimer = setTimeout(() => {
        void pollJob();
      }, 500);
    };

    res.on("close", () => {
      isClosed = true;
      if (pollTimer) clearTimeout(pollTimer);
      // remote the pdf file from server
      fs.unlinkSync(JSON.parse(job?.data)?.path);
      console.log("🗑️ Deleted the PDF file from server!");
    });

    void pollJob();
  })



  app.post("/chat", async (req, res) => {
    const userPrompt = req.body.userPrompt;
    if(!userPrompt){
      return res.status(400).json({error: "User query is required"});
    }

    //? Similarity Search: User ki query se milte-julte documents ko vector database se search karta hai.
    // (await vectorStore).similaritySearch(userQuery, 3); //k:3 , means 3 relevent document
    //? Retriever: Documents retrieve karne ka interface hai, jo similarity search ya doosri retrieval techniques ka use kar sakta hai.
    // mujhe user query ko embeddings bana kr search krne ka jaroorat nhi h ye internally embddding bana kr hi search krta hai

    const retriever = (await vectorStore).asRetriever({k: 3});
    const results = await retriever.invoke(userPrompt);
    // console.log("🔍 Similarity Search Results:", results);
    console.log("🔍 Similarity Search Results Retrieved");

    const response = await callChatLLM(userPrompt, JSON.stringify(results));
    // console.log("🤖 LLM Response:", response);

    res.status(200).json({message: "Docs retrieval successfully", llmResponse: response, documents: JSON.stringify(results)});
  })


  return app;
}
