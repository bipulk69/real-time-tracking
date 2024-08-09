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
exports.setupSocketIO = setupSocketIO;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function setupSocketIO(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
        },
    });
    io.use((socket, next) => __awaiter(this, void 0, void 0, function* () {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            socket.userRole = decoded.role;
            next();
        }
        catch (error) {
            next(new Error('Authentication error'));
        }
    }));
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);
        socket.join(`user:${socket.userId}`);
        socket.join(`role:${socket.userRole}`);
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);
        });
        setupOrderHandlers(io, socket);
        setupLocationHandlers(io, socket);
    });
    return io;
}
function setupOrderHandlers(io, socket) {
    socket.on('updateOrderStatus', (data) => __awaiter(this, void 0, void 0, function* () {
        try {
            const updatedOrder = yield prisma.order.update({
                where: { id: data.orderId },
                data: { status: data.status },
                include: { customer: true },
            });
            io.to(`user:${updatedOrder.customerId}`).emit('orderStatusUpdated', updatedOrder);
            if (data.status === client_1.OrderStatus.ACCEPTED) {
                io.to('role:DELIVERY_PERSONNEL').emit('newOrderAvailable', updatedOrder);
            }
        }
        catch (error) {
            console.error('Error updating order status:', error);
        }
    }));
}
function setupLocationHandlers(io, socket) {
    socket.on('updateLocation', (data) => __awaiter(this, void 0, void 0, function* () {
        if (socket.userRole !== client_1.UserRole.DELIVERY_PERSONNEL) {
            return;
        }
        try {
            const location = yield prisma.location.create({
                data: {
                    userId: socket.userId,
                    latitude: data.latitude,
                    longitude: data.longitude,
                },
            });
            const activeOrders = yield prisma.order.findMany({
                where: {
                    status: client_1.OrderStatus.IN_TRANSIT,
                    // Add condition to check if this delivery personnel is assigned to the order
                },
            });
            activeOrders.forEach((order) => {
                io.to(`user:${order.customerId}`).emit('deliveryLocationUpdated', {
                    orderId: order.id,
                    location,
                });
            });
        }
        catch (error) {
            console.error('Error updating location:', error);
        }
    }));
}
