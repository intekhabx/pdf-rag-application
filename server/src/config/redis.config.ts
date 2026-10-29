import {Redis} from "ioredis";

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
})

redis.on("connect", ()=> {
  console.log("Redis Connection Done✅");
})

export default redis;
