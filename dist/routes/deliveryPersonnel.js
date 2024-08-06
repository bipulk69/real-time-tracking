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
const createOrderSchema = zod_1.z.object({
    restaurantId: zod_1.z.number().positive(),
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.number().positive(),
        quantity: zod_1.z.number().positive(),
    })),
});
const updateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELED']),
});
function validateRequest(schema, req, res) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ errors: result.error.errors });
        return null;
    }
    return result.data;
}
router.post('/', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = validateRequest(createOrderSchema, req, res);
    if (!data)
        return;
    try {
        const order = yield prisma.order.create({
            data: {
                customerId: req.userData.userId,
                restaurantId: data.restaurantId,
                status: 'PENDING',
                items: {
                    create: data.items.map((item) => ({
                        itemId: item.itemId,
                        quantity: item.quantity,
                    })),
                },
            },
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });
        const totalAmount = order.items.reduce((sum, orderItem) => sum + (orderItem.quantity * orderItem.item.price), 0);
        const orderData = Object.assign(Object.assign({}, order), { totalAmount });
        res.status(201).json(orderData);
    }
    catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Error creating order' });
    }
}));
router.get('/', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orders = yield prisma.order.findMany({
            where: { customerId: req.userData.userId },
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const ordersData = orders.map(order => (Object.assign(Object.assign({}, order), { totalAmount: order.items.reduce((sum, orderItem) => sum + (orderItem.quantity * orderItem.item.price), 0) })));
        res.json(ordersData);
    }
    catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders' });
    }
}));
router.get('/:id', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const order = yield prisma.order.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.customerId !== req.userData.userId && req.userData.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }
        const orderData = Object.assign(Object.assign({}, order), { totalAmount: order.items.reduce((sum, orderItem) => sum + (orderItem.quantity * orderItem.item.price), 0) });
        res.json(orderData);
    }
    catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ message: 'Error fetching order' });
    }
}));
router.patch('/:id/status', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.userData.role !== 'ADMIN' && req.userData.role !== 'DELIVERY_PERSONNEL') {
        return res.status(403).json({ message: 'Not authorized to update order status' });
    }
    const { id } = req.params;
    const data = validateRequest(updateOrderStatusSchema, req, res);
    if (!data)
        return;
    try {
        const updatedOrder = yield prisma.order.update({
            where: { id: parseInt(id) },
            data: { status: data.status },
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });
        const orderData = Object.assign(Object.assign({}, updatedOrder), { totalAmount: updatedOrder.items.reduce((sum, orderItem) => sum + (orderItem.quantity * orderItem.item.price), 0) });
        res.json(orderData);
    }
    catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Error updating order status' });
    }
}));
router.patch('/:id/cancel', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const order = yield prisma.order.findUnique({
            where: { id: parseInt(id) },
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.customerId !== req.userData.userId) {
            return res.status(403).json({ message: 'Not authorized to cancel this order' });
        }
        if (order.status !== 'PENDING') {
            return res.status(400).json({ message: 'Can only cancel pending orders' });
        }
        const updatedOrder = yield prisma.order.update({
            where: { id: parseInt(id) },
            data: { status: 'CANCELED' },
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });
        const orderData = Object.assign(Object.assign({}, updatedOrder), { totalAmount: updatedOrder.items.reduce((sum, orderItem) => sum + (orderItem.quantity * orderItem.item.price), 0) });
        res.json(orderData);
    }
    catch (error) {
        console.error('Error canceling order:', error);
        res.status(500).json({ message: 'Error canceling order' });
    }
}));
exports.default = router;
