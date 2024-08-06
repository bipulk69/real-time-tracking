import express, { Request, Response } from "express";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { TwitterApi } from "twitter-api-v2";
import nodemailer from "nodemailer";
import crypto from "crypto";

const router = express.Router();
const prisma = new PrismaClient();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


interface UserData {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthResponse {
  message: string;
  token: string;
  user: UserData;
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be atleast six character"),
  role: z.enum(["CUSTOMER", "DELIVERY_PERSONNEL"] as const),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

const googleLoginSchema = z.object({
  token: z.string(),
});

function validateRequest<T>(
  schema: z.ZodSchema<T>,
  req: Request,
  res: Response
): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.errors });
    return null;
  }
  return result.data;
}

router.post("/register", async (req: Request, res: Response) => {
  const data = validateRequest(registerSchema, req, res);
  if (!data) {
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({ mesage: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    const response: AuthResponse = {
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal servel error",
    });
  }
});

router.post("/signin", async (req: Request, res: Response) => {
  const data = validateRequest(loginSchema, req, res);
  if (!data) return;

  try {
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    const response: AuthResponse = {
      message: "Login Successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
});

router.post("/google-login", async (req: Request, res: Response) => {
  const data = validateRequest(googleLoginSchema, req, res);
  if (!data) return;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: data.token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Invalid google token" });
    }

    let user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name || "Google User",
          password: "",
          role: "CUSTOMER",
          googleId: payload.sub,
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
});

router.get("/twitter-login", async (req: Request, res: Response) => {
  try {
    const { url, oauth_token, oauth_token_secret } =
      await twitterClient.generateAuthLink(process.env.TWITTER_CALLBACK_URL!);

    res.cookie("oauth_token_secret", oauth_token_secret, {
      httpOnly: true,
      secure: true,
    });

    res.json({ url, oauth_token });
  } catch (error) {
    console.error("Twitter login initiation error:", error);
    res.status(500).json({ message: "Error initiating Twitter login" });
  }
});

router.get("/twitter-callback", async (req: Request, res: Response) => {
  const { oauth_token, oauth_verifier } = req.query;
  const oauth_token_secret = req.cookies.oauth_token_secret;

  if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
    return res.status(400).json({ message: "Invalid Twitter callback" });
  }

  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: oauth_token as string,
      accessSecret: oauth_token_secret,
    });

    const {
      client: loggedClient,
      accessToken,
      accessSecret,
    } = await client.login(oauth_verifier as string);
    const twitterUser = await loggedClient.v2.me();

    let user = await prisma.user.findUnique({
      where: { twitterId: twitterUser.data.id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `twitter_${twitterUser.data.id}@example.com`,
          name: twitterUser.data.name,
          password: await bcrypt.hash(Math.random().toString(36).slice(-8), 10),
          role: "CUSTOMER" as UserRole,
          twitterId: twitterUser.data.id,
        },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    res.clearCookie("oauth_token_secret");

    res.json({
      message: "Twitter login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Twitter login callback error:", error);
    res.status(500).json({ message: "Error during Twitter login" });
  }
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  const data = validateRequest(forgotPasswordSchema, req, res);
  if (!data) return;

  try {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.json({
        message:
          "If a user with that email exists, a password reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await transporter.sendMail({
      to: user.email,
      subject: "Password Reset Request",
      text: `You requested a password reset. Please go to this link to reset your password: ${resetUrl}`,
      html: `<p>You requested a password reset. Please click the link below to reset your password:</p>
             <a href="${resetUrl}">Reset Password</a>`,
    });

    res.json({
      message:
        "If a user with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res
      .status(500)
      .json({ message: "Error processing password reset request" });
  }
});


router.post("/reset-password", async (req: Request, res: Response) => {
  const data = validateRequest(resetPasswordSchema, req, res);
  if (!data) return;

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: data.token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Error resetting password" });
  }
});

export default router;
