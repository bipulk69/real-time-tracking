import express, { Request, Response } from "express";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import { z } from "zod";

const router = express.Router();
const prisma = new PrismaClient();

interface UserData {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthResponse {
  message: string;
  token: string;
  user: UserData;
}

// Zod schema
const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be atleast six character"),
  role: z.enum(["CUSTOMER", "DELIVERY_PERSONNEL"] as const),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

// Helper function
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


router.post('/register', async(req: Request, res: Response) => {
    const data = validateRequest(registerSchema, req, res);
    if(!data){
        return;
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: {email: data.email}
        })
    
        if(existingUser){
            return res.status(400).json({ mesage: 'User already exists'});
        }
    
        const hashedPassword = await bcrypt.hash(data.password, 10)
    
        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                role: data.role,
            },
        })

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role},
            process.env.JWT_SECRET!,
            { expiresIn: '1h' }
        );

        const response: AuthResponse = {
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        }

        res.status(200).json(response)
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: false,
            message: 'Internal servel error'
        })
    }


})