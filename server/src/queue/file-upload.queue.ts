import { Queue } from "bullmq"
import redis from "../config/redis.config.js";


const fileUploadQueue = new Queue("file-upload-queue", {
  connection: redis,

  defaultJobOptions: { //this config is not required
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

export default fileUploadQueue;
