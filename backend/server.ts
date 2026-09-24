import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import authRoutes from "./routes/authRoutes";
import projectRoutes from "./routes/projectRoute";
import endpointRoutes from "./routes/endpointRoutes";
import workflowRoutes from "./routes/workflowRoutes";
import testRoutes from "./routes/testRoutes";
import { attachWsServer } from "./ws/server";

dotenv.config();
const app = express();
const server = http.createServer(app);
attachWsServer(server);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // e.g. https://your-dashboard.vercel.app — NOT "*"
    credentials: true,
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/worflows/:projectId", workflowRoutes);
app.use("/api/tests/:projectId", testRoutes);


const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;