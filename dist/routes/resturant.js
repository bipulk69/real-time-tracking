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
const createRestaurantSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Restaurant name is required"),
    location: zod_1.z.string().min(1, "Location is required"),
});
const addMenuItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Item name is required"),
    price: zod_1.z.number().positive("Price must be positive"),
});
function validateRequest(schema, req, res) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ errors: result.error.errors });
        return null;
    }
    return result.data;
}
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const restaurants = yield prisma.restaurant.findMany({
            select: { id: true, name: true, location: true },
        });
        res.json(restaurants);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
}));
router.get("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const restaurant = yield prisma.restaurant.findUnique({
            where: { id: parseInt(id) },
            include: { items: true },
        });
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }
        const restaurantData = {
            id: restaurant.id,
            name: restaurant.name,
            location: restaurant.location,
            items: restaurant.items.map((item) => ({
                id: item.id,
                name: item.name,
                price: item.price,
            })),
        };
        res.json(restaurantData);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
}));
router.post("/", auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (((_a = req.userData) === null || _a === void 0 ? void 0 : _a.role) !== "ADMIN") {
        return res
            .status(403)
            .json({ message: "Only admins can create restaurants" });
    }
    const data = validateRequest(createRestaurantSchema, req, res);
    if (!data)
        return;
    try {
        const restaurant = yield prisma.restaurant.create({
            data: {
                name: data.name,
                location: data.location,
            },
        });
        res.status(201).json(restaurant);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
}));
exports.default = router;
