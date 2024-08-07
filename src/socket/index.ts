import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient, UserRole, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: UserRole;
}

export function setupSocketIO(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; role: UserRole };
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
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

function setupOrderHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  socket.on('updateOrderStatus', async (data: { orderId: number; status: OrderStatus }) => {
    try {
      const updatedOrder = await prisma.order.update({
        where: { id: data.orderId },
        data: { status: data.status },
        include: { customer: true },
      });

      io.to(`user:${updatedOrder.customerId}`).emit('orderStatusUpdated', updatedOrder);

      if (data.status === OrderStatus.ACCEPTED) {
        io.to('role:DELIVERY_PERSONNEL').emit('newOrderAvailable', updatedOrder);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  });
}

function setupLocationHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  socket.on('updateLocation', async (data: { latitude: number; longitude: number }) => {
    if (socket.userRole !== UserRole.DELIVERY_PERSONNEL) {
      return;
    }

    try {
      const location = await prisma.location.create({
        data: {
          userId: socket.userId!,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      });

      const activeOrders = await prisma.order.findMany({
        where: {
          status: OrderStatus.IN_TRANSIT,
          // Add condition to check if this delivery personnel is assigned to the order
        },
      });

      activeOrders.forEach((order) => {
        io.to(`user:${order.customerId}`).emit('deliveryLocationUpdated', {
          orderId: order.id,
          location,
        });
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  });
}