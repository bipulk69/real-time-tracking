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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const console_1 = require("console");
const primsa = new client_1.PrismaClient();
const auth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: "Authorization header missing" });
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "Missing token" });
        }
        const decodedToke = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = yield primsa.user.findUnique({
            where: { id: decodedToke.userId },
            select: { id: true, email: true, role: true },
        });
        if (!user) {
            return res.status(401).json({
                message: 'Invalid user'
            });
        }
        req.userData = {
            userId: user.id,
            email: user.email,
            role: user.role
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            if (error.name == "TokenExpiredError") {
                return res.status(401).json({ message: "Token has expired" });
            }
            return res.status(401).json({ message: "Invalid token" });
        }
    }
    console.error("Auth middleware error", console_1.error);
    return res.status(500).json({ message: "Internal server error" });
});
exports.default = auth;
