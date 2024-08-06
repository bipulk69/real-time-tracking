"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const google_auth_library_1 = require("google-auth-library");
const twitter_api_v2_1 = require("twitter-api-v2");
const nodemailer_1 = __importDefault(require("nodemailer"));
const crypto_1 = __importDefault(require("crypto"));
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const twitterClient = new twitter_api_v2_1.TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
});
const transporter = nodemailer_1.default.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email"),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string(),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
});
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    email: zod_1.z.string().email("Invalid email"),
    password: zod_1.z.string().min(6, "Password must be atleast six character"),
    role: zod_1.z.enum(["CUSTOMER", "DELIVERY_PERSONNEL"]),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email"),
    password: zod_1.z.string().min(1, "Password is required"),
});
const googleLoginSchema = zod_1.z.object({
    token: zod_1.z.string(),
});
function validateRequest(schema, req, res) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ errors: result.error.errors });
        return null;
    }
    return result.data;
}
router.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = validateRequest(registerSchema, req, res);
    if (!data) {
        return;
    }
    try {
        const existingUser = yield prisma.user.findUnique({
            where: { email: data.email },
        });
        if (existingUser) {
            return res.status(400).json({ mesage: "User already exists" });
        }
        const hashedPassword = yield bcrypt_1.default.hash(data.password, 10);
        const user = yield prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                role: data.role,
            },
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const response = {
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
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal servel error",
        });
    }
}));
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = validateRequest(loginSchema, req, res);
    if (!data)
        return;
    try {
        const user = yield prisma.user.findUnique({ where: { email: data.email } });
        if (!user) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
        const isPasswordValid = yield bcrypt_1.default.compare(data.password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const response = {
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
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
}));
router.post("/google-login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = validateRequest(googleLoginSchema, req, res);
    if (!data)
        return;
    try {
        const ticket = yield googleClient.verifyIdToken({
            idToken: data.token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return res.status(400).json({ message: "Invalid google token" });
        }
        let user = yield prisma.user.findUnique({
            where: { email: payload.email },
        });
        if (!user) {
            user = yield prisma.user.create({
                data: {
                    email: payload.email,
                    name: payload.name || "Google User",
                    password: "",
                    role: "CUSTOMER",
                    googleId: payload.sub,
                },
            });
        }
        else if (!user.googleId) {
            user = yield prisma.user.update({
                where: { id: user.id },
                data: { googleId: payload.sub },
            });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
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
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
}));
router.get("/twitter-login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { url, oauth_token, oauth_token_secret } = yield twitterClient.generateAuthLink(process.env.TWITTER_CALLBACK_URL);
        res.cookie("oauth_token_secret", oauth_token_secret, {
            httpOnly: true,
            secure: true,
        });
        res.json({ url, oauth_token });
    }
    catch (error) {
        console.error("Twitter login initiation error:", error);
        res.status(500).json({ message: "Error initiating Twitter login" });
    }
}));
router.get("/twitter-callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { oauth_token, oauth_verifier } = req.query;
    const oauth_token_secret = req.cookies.oauth_token_secret;
    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
        return res.status(400).json({ message: "Invalid Twitter callback" });
    }
    try {
        const client = new twitter_api_v2_1.TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: oauth_token,
            accessSecret: oauth_token_secret,
        });
        const { client: loggedClient, accessToken, accessSecret, } = yield client.login(oauth_verifier);
        const twitterUser = yield loggedClient.v2.me();
        let user = yield prisma.user.findUnique({
            where: { twitterId: twitterUser.data.id },
        });
        if (!user) {
            user = yield prisma.user.create({
                data: {
                    email: `twitter_${twitterUser.data.id}@example.com`,
                    name: twitterUser.data.name,
                    password: yield bcrypt_1.default.hash(Math.random().toString(36).slice(-8), 10),
                    role: "CUSTOMER",
                    twitterId: twitterUser.data.id,
                },
            });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
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
    }
    catch (error) {
        console.error("Twitter login callback error:", error);
        res.status(500).json({ message: "Error during Twitter login" });
    }
}));
router.post("/forgot-password", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = validateRequest(forgotPasswordSchema, req, res);
    if (!data)
        return;
    try {
        const user = yield prisma.user.findUnique({ where: { email: data.email } });
        if (!user) {
            return res.json({
                message: "If a user with that email exists, a password reset link has been sent.",
            });
        }
        const resetToken = crypto_1.default.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 3600000);
        yield prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry },
        });
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        yield transporter.sendMail({
            to: user.email,
            subject: "Password Reset Request",
            text: `You requested a password reset. Please go to this link to reset your password: ${resetUrl}`,
            html: `<p>You requested a password reset. Please click the link below to reset your password:</p>
             <a href="${resetUrl}">Reset Password</a>`,
        });
        res.json({
            message: "If a user with that email exists, a password reset link has been sent.",
        });
    }
    catch (error) {
        console.error("Forgot password error:", error);
        res
            .status(500)
            .json({ message: "Error processing password reset request" });
    }
}));
router.post("/reset-password", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = validateRequest(resetPasswordSchema, req, res);
    if (!data)
        return;
    try {
        const user = yield prisma.user.findFirst({
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
        const hashedPassword = yield bcrypt_1.default.hash(data.password, 10);
        yield prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });
        res.json({ message: "Password has been reset successfully" });
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: "Error resetting password" });
    }
}));
exports.default = router;
