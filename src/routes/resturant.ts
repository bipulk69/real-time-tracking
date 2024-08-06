import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import auth from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

interface RestaurantData {
  id: number;
  name: string;
  location: string;
  items?: {
    id: number;
    price: number;
    name: string;
  }[];
}

const createRestaurantSchema = z.object({
  name: z.string().min(1, "Restaurant name is required"),
  location: z.string().min(1, "Location is required"),
});

const addMenuItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  price: z.number().positive("Price must be positive"),
});

function validateRequest<T>(
  schema: z.ZodSchema<T>,
  req: Request,
  res: Response
): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.errors });
    return null;
  }
  return result.data;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true, location: true },
    });
    res.json(restaurants);
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(id) },
      include: { items: true },
    });
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const restaurantData: RestaurantData = {
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
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
});

router.post("/", auth, async (req: Request, res: Response) => {
  if (req.userData?.role !== "ADMIN") {
    return res
      .status(403)
      .json({ message: "Only admins can create restaurants" });
  }

  const data = validateRequest(createRestaurantSchema, req, res);
  if (!data) return;

  try {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: data.name,
        location: data.location,
      },
    });

    res.status(201).json(restaurant);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
});

export default router;