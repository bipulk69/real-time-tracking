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
const zod_1 = require("zod");
const auth_1 = __importDefault(require("../middleware/auth"));
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required").optional(),
    email: zod_1.z.string().email("Invalid email").optional(),
});
function validateRequest(schema, req, res) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ errors: result.error.errors });
        return null;
    }
    return result.data;
}
router.get("/profile", auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield prisma.user.findUnique({
            where: { id: req.userData.userId },
            select: { id: true, name: true, email: true, role: true },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const userProfile = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        };
        res.json(userProfile);
    }
    catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Error fetching user profile" });
    }
}));
router.patch('/profile', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = validateRequest(updateProfileSchema, req, res);
    if (!data)
        return null;
    try {
        const updateUser = yield prisma.user.update({
            where: { id: req.userData.userId },
            data: {
                name: data.name,
                email: data.email
            },
            select: { id: true, name: true, email: true, role: true }
        });
        const userProfile = {
            id: updateUser.id,
            email: updateUser.email,
            name: updateUser.name,
            role: updateUser.role
        };
        res.json({ userProfile });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        });
    }
}));
router.get('/order', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orders = yield prisma.order.findMany({
            where: { customerId: req.userData.userId },
            include: {
                restaurant: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { name: true, price: true } }
                    }
                }
            }
        });
        res.json(orders);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        });
    }
}));
router.delete('/account', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma.user.delete({
            where: { id: req.userData.userId }
        });
        res.status(200).json({
            message: "User account delete successfully"
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        });
    }
}));
exports.default = router;
