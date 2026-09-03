import express from "express";
import dotenv from "dotenv";
import http from "http";

dotenv.config();
const app = express();
const server = http.createServer(app);


const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;