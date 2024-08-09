// socket/orderEvents.ts

import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient, OrderStatus, UserRole } from '@prisma/client';
import { AuthenticatedSocket } from './types';

const prisma = new PrismaClient();

export function setupOrderEvents(io: SocketIOServer, socket: AuthenticatedSocket) {
  // Handler for creating a new order
  socket.on('createOrder', async (orderData: { restaurantId: number; items: { itemId: number; quantity: number }[] }) => {
    try {
      const newOrder = await prisma.order.create({
        data: {
          customerId: socket.userId!,
          restaurantId: orderData.restaurantId,
          status: OrderStatus.PENDING,
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

    } catch (error) {
      console.error('Error creating order:', error);
      socket.emit('orderError', { message: 'Failed to create order' });
    }
  });

  // Handler for updating order status
  socket.on('updateOrderStatus', async (data: { orderId: number; status: OrderStatus }) => {
    try {
      const updatedOrder = await prisma.order.update({
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
      if (data.status === OrderStatus.ACCEPTED) {
        io.to('role:DELIVERY_PERSONNEL').emit('newOrderAvailable', updatedOrder);
      }

      // If the order is assigned to a delivery person, notify them
      if (data.status === OrderStatus.IN_TRANSIT && socket.userRole === UserRole.DELIVERY_PERSONNEL) {
        io.to(`user:${socket.userId}`).emit('orderAssigned', updatedOrder);
      }

    } catch (error) {
      console.error('Error updating order status:', error);
      socket.emit('orderError', { message: 'Failed to update order status' });
    }
  });

  // Handler for cancelling an order
  socket.on('cancelOrder', async (orderId: number) => {
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      if (!order || order.customerId !== socket.userId) {
        throw new Error('Order not found or not authorized to cancel');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new Error('Cannot cancel order that is not in pending status');
      }

      const cancelledOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELED },
        include: {
          customer: true,
          restaurant: true
        }
      });

      // Notify the customer that their order was cancelled
      socket.emit('orderCancelled', cancelledOrder);

      // Notify the restaurant about the cancellation
      io.to(`restaurant:${cancelledOrder.restaurantId}`).emit('orderCancelled', cancelledOrder);

    } catch (error) {
      console.error('Error cancelling order:', error);
      socket.emit('orderError', { message: 'Failed to cancel order' });
    }
  });
}