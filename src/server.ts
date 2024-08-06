import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors'
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import resturantRoute from './routes/resturant';

dotenv.config()

const app = express()

const prisma = new PrismaClient();

app.use(cors())
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', resturantRoute);


app.get('/', (req, res) => {
    res.send('Delivery API is running')
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})

process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit();
  });