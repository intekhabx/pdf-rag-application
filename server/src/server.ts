import "dotenv/config";
import http from "node:http";
import expressApplication from "./app.js";


async function main() {
  const PORT = process.env.PORT ?? 8000;

  const app = expressApplication();
  const server = http.createServer(app);


  server.listen(PORT, ()=> {
    console.log(`Server is running on port ${PORT}`);
  })
}

main();
