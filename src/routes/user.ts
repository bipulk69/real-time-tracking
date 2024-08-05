import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import auth from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
}

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email").optional(),
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

router.get("/profile", auth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userData!.userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userProfile: UserProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    res.json(userProfile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile" });
  }
});

router.patch('/profile', auth, async (req: Request, res: Response) => {
    const data = validateRequest(updateProfileSchema, req, res);
    if(!data) return null;
    try {
        const updateUser = await prisma.user.update({
            where: { id: req.userData!.userId},
            data: {
                name: data.name,
                email: data.email
            },
            select: {id: true, name: true, email: true, role: true}
        })

        const userProfile: UserProfile = {
            id: updateUser.id,
            email: updateUser.email,
            name: updateUser.name,
            role: updateUser.role
        }

        res.json({userProfile})

        
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        })
    }
})

router.get('/order', async (req: Request, res: Response) => {
    try {
        const orders = await prisma.order.findMany({
            where: { customerId: req.userData!.userId},
            include: {
                restaurant: { select: {name: true}},
                items: {
                    include: {
                        item: {select:{ name: true, price: true}}
                    }
                }
            }
        })

        res.json(orders)
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        })
    }
})


router.delete('/account', auth, async (req: Request, res: Response) => {
    try {
        await prisma.user.delete({
            where: {id: req.userData!.userId}
        })

        res.status(200).json({
            message: "User account delete successfully"
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        })
    }
})


export default router;