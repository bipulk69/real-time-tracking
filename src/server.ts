import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import resturantRoute from "./routes/resturant";
import orderRoutes from "./routes/order";
import deliveryRoutes from "./routes/deliveryPersonnel";
import helmet from "helmet";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/restaurants", resturantRoute);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);

app.get("/", (req, res) => {
  res.send("Delivery API is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM signal receiver: closing HTTP server");
  await prisma.$disconnect();
  process.exit();
});


export default app;