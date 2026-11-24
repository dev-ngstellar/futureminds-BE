// src/registration/entity/registration.entity.ts
export class Registration {
    id: string;

    userId?: string;

    name: string;
    referenceNumber?: string;
    email: string;
    gender: string;
    dateOfBirth: Date;
    age: number;

    presentAddress: string;
    mobileNumber: string;
    medicalHistory?: string;

    tshirtSize: string;
    raceCategory: string;

    state: string;
    city: string;
    pincode: string;

    emergencyContactName: string;
    emergencyContactMobile: string;
    waiverAccepted: boolean;

    amount: number;

    paymentStatus: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    ticketId?: string;

    emailSent: boolean;
    finalRegistration: boolean;

    createdAt: Date;
    updatedAt: Date;
}
