import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    // 1. Critical Startup Security Check: Enforce JWT_SECRET
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
        console.error('FATAL STARTUP ERROR: JWT_SECRET environment variable is missing.');
        process.exit(1);
    }

    const app = await NestFactory.create(AppModule, {
        rawBody: true, // ✅ Preserved for Razorpay webhook signature verification
    });

    // 2. Explicit CORS Restriction
    const configuredOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

    const defaultDevOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
    ];

    const allowedOrigins = Array.from(new Set([...defaultDevOrigins, ...configuredOrigins]));

    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, curl, Razorpay webhooks)
            if (!origin) {
                return callback(null, true);
            }
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error(`CORS policy blocked access from origin: ${origin}`), false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature'],
    });

    // 3. Strict Validation Pipe (forbidNonWhitelisted: true)
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`🚀 Marathon Backend running on: http://localhost:${port}`);
}

bootstrap();
