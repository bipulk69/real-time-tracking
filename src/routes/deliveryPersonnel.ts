import express, { Request, Response } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import auth from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Interfaces
interface OrderItem {
  itemId: number;
  quantity: number;
}

interface OrderData {
  id: number;
  customerId: number;
  restaurantId: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: number;
    itemId: number;
    quantity: number;
    item: {
      name: string;
      price: number;
    };
  }[];
  totalAmount: number;
}


const createOrderSchema = z.object({
  restaurantId: z.number().positive(),
  items: z.array(z.object({
    itemId: z.number().positive(),
    quantity: z.number().positive(),
  })),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELED']),
});


function validateRequest<T>(schema: z.ZodSchema<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.errors });
    return null;
  }
  return result.data;
}


router.post('/', auth, async (req: Request, res: Response) => {
  const data = validateRequest(createOrderSchema, req, res);
  if (!data) return;

  try {
    const order = await prisma.order.create({
      data: {
        customerId: req.userData!.userId,
        restaurantId: data.restaurantId,
        status: 'PENDING',
        items: {
          create: data.items.map((item: OrderItem) => ({
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

    const totalAmount = order.items.reduce((sum, orderItem) => 
      sum + (orderItem.quantity * orderItem.item.price), 0);

    const orderData: OrderData = {
      ...order,
      totalAmount,
    };

    res.status(201).json(orderData);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Error creating order' });
  }
});


router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.userData!.userId },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ordersData: OrderData[] = orders.map(order => ({
      ...order,
      totalAmount: order.items.reduce((sum, orderItem) => 
        sum + (orderItem.quantity * orderItem.item.price), 0),
    }));

    res.json(ordersData);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});


router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
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

    if (order.customerId !== req.userData!.userId && req.userData!.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    const orderData: OrderData = {
      ...order,
      totalAmount: order.items.reduce((sum, orderItem) => 
        sum + (orderItem.quantity * orderItem.item.price), 0),
    };

    res.json(orderData);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Error fetching order' });
  }
});


router.patch('/:id/status', auth, async (req: Request, res: Response) => {
  if (req.userData!.role !== 'ADMIN' && req.userData!.role !== 'DELIVERY_PERSONNEL') {
    return res.status(403).json({ message: 'Not authorized to update order status' });
  }

  const { id } = req.params;
  const data = validateRequest(updateOrderStatusSchema, req, res);
  if (!data) return;

  try {
    const updatedOrder = await prisma.order.update({
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

    const orderData: OrderData = {
      ...updatedOrder,
      totalAmount: updatedOrder.items.reduce((sum, orderItem) => 
        sum + (orderItem.quantity * orderItem.item.price), 0),
    };

    res.json(orderData);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status' });
  }
});


router.patch('/:id/cancel', auth, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.customerId !== req.userData!.userId) {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ message: 'Can only cancel pending orders' });
    }

    const updatedOrder = await prisma.order.update({
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

    const orderData: OrderData = {
      ...updatedOrder,
      totalAmount: updatedOrder.items.reduce((sum, orderItem) => 
        sum + (orderItem.quantity * orderItem.item.price), 0),
    };

    res.json(orderData);
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).json({ message: 'Error canceling order' });
  }
});

export default router;