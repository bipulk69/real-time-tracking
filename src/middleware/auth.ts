import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, UserRole } from "@prisma/client";
import { error } from "console";

const primsa = new PrismaClient();

interface jwtPayload {
  userId: number;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      userData?: jwtPayload;
    }
  }
}

const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const decodedToke = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as jwtPayload;

    const user = await primsa.user.findUnique({
      where: { id: decodedToke.userId },
      select: { id: true, email: true, role: true },
    });

    if(!user){
        return res.status(401).json({
            message: 'Invalid user'
        })
    }

    req.userData = {
        userId: user.id,
        email: user.email,
        role: user.role
    }

    next();

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      if (error.name == "TokenExpiredError") {
        return res.status(401).json({ message: "Token has expired" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }
  }
  console.error("Auth middleware error", error);
  return res.status(500).json({ message: "Internal server error" });
};

export default auth;
