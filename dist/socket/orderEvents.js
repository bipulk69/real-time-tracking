"use strict";
// socket/orderEvents.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupOrderEvents = setupOrderEvents;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function setupOrderEvents(io, socket) {
    // Handler for creating a new order
    socket.on('createOrder', (orderData) => __awaiter(this, void 0, void 0, function* () {
        try {
            const newOrder = yield prisma.order.create({
                data: {
                    customerId: socket.userId,
                    restaurantId: orderData.restaurantId,
                    status: client_1.OrderStatus.PENDING,
                    items: {
                        create: orderData.items.map(item => ({
                            itemId: item.itemId,
                            quantity: item.quantity
                        }))
                    }
                },
                include: {
                    customer: true,
                    restaurant: true,
                    items: {
                        include: {
                            item: true
                        }
                    }
                }
            });
            // Notify the customer that their order was created
            socket.emit('orderCreated', newOrder);
            // Notify the restaurant about the new order
            io.to(`restaurant:${newOrder.restaurantId}`).emit('newOrder', newOrder);
        }
        catch (error) {
            console.error('Error creating order:', error);
            socket.emit('orderError', { message: 'Failed to create order' });
        }
    }));
    // Handler for updating order status
    socket.on('updateOrderStatus', (data) => __awaiter(this, void 0, void 0, function* () {
        try {
            const updatedOrder = yield prisma.order.update({
                where: { id: data.orderId },
                data: { status: data.status },
                include: {
                    customer: true,
                    restaurant: true,
                    items: {
                        include: {
                            item: true
                        }
                    }
                }
            });
            // Notify the customer about the order status update
            io.to(`user:${updatedOrder.customerId}`).emit('orderStatusUpdated', updatedOrder);
            // If the order is accepted, notify available delivery personnel
            if (data.status === client_1.OrderStatus.ACCEPTED) {
                io.to('role:DELIVERY_PERSONNEL').emit('newOrderAvailable', updatedOrder);
            }
            // If the order is assigned to a delivery person, notify them
            if (data.status === client_1.OrderStatus.IN_TRANSIT && socket.userRole === client_1.UserRole.DELIVERY_PERSONNEL) {
                io.to(`user:${socket.userId}`).emit('orderAssigned', updatedOrder);
            }
        }
        catch (error) {
            console.error('Error updating order status:', error);
            socket.emit('orderError', { message: 'Failed to update order status' });
        }
    }));
    // Handler for cancelling an order
    socket.on('cancelOrder', (orderId) => __awaiter(this, void 0, void 0, function* () {
        try {
            const order = yield prisma.order.findUnique({ where: { id: orderId } });
            if (!order || order.customerId !== socket.userId) {
                throw new Error('Order not found or not authorized to cancel');
            }
            if (order.status !== client_1.OrderStatus.PENDING) {
                throw new Error('Cannot cancel order that is not in pending status');
            }
            const cancelledOrder = yield prisma.order.update({
                where: { id: orderId },
                data: { status: client_1.OrderStatus.CANCELED },
                include: {
                    customer: true,
                    restaurant: true
                }
            });
            // Notify the customer that their order was cancelled
            socket.emit('orderCancelled', cancelledOrder);
            // Notify the restaurant about the cancellation
            io.to(`restaurant:${cancelledOrder.restaurantId}`).emit('orderCancelled', cancelledOrder);
        }
        catch (error) {
            console.error('Error cancelling order:', error);
            socket.emit('orderError', { message: 'Failed to cancel order' });
        }
    }));
}
