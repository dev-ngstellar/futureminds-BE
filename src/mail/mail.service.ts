import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail', // or use host/port from env
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }

    async sendTicketId(email: string, referenceNumber: string, amount: string, eventDetails: { name: string, venue: string, category: string, date: string, userName: string }) {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Marathon Event Registration Successful',
            text: `Dear ${eventDetails.userName},

Thank you for registering for ${eventDetails.name}! 
            
Registration Details:
- Date: ${eventDetails.date}
- Venue: ${eventDetails.venue}
- Category: ${eventDetails.category}
- Reference Number: ${referenceNumber}
- Amount Paid: ₹${amount}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2c3e50;">Registration Successful!</h1>
            <p>Dear <strong>${eventDetails.userName}</strong>,</p>
            <p>Thank you for registering for the <strong>${eventDetails.name}</strong>.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Event Details:</h3>
                <p><strong>📅 Date:</strong> ${eventDetails.date}</p>
                <p><strong>📍 Venue:</strong> ${eventDetails.venue}</p>
                <p><strong>🏃 Category:</strong> ${eventDetails.category}</p>
                <p><strong>🎫 Reference Number:</strong> <span style="font-size: 1.2em; color: #27ae60;">${referenceNumber}</span></p>
                <p><strong>💰 Amount Paid:</strong> ₹${amount}</p>
            </div>
            
            <p>Please keep this Reference Number safe for entry.</p>
            <p>See you at the starting line!</p>
        </div>
      `,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent: ' + info.response);
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }
}
