import { Registration } from '../../registration/entity/registration.entity';
import { RaceCategory } from '../../registration/dto/registration.dto';
import { UpdateRegistrationDto } from '../../registration/dto/update-registration.dto';

export class RegistrationMapper {
    static applyUpdate(
        existing: Registration,
        dto: Partial<UpdateRegistrationDto>,
    ): Registration {
        const updated: Registration = { ...existing };

        if (dto.name !== undefined)
            updated.name = dto.name;

        if (dto.email !== undefined)
            updated.email = dto.email;

        if (dto.gender !== undefined)
            updated.gender = dto.gender;

        if (dto.dateOfBirth !== undefined)
            updated.dateOfBirth = new Date(dto.dateOfBirth);

        if (dto.age !== undefined)
            updated.age = dto.age;

        if (dto.presentAddress !== undefined)
            updated.presentAddress = dto.presentAddress;

        if (dto.state !== undefined)
            updated.state = dto.state;

        if (dto.city !== undefined)
            updated.city = dto.city;

        if (dto.pincode !== undefined)
            updated.pincode = dto.pincode;

        if (dto.mobileNumber !== undefined)
            updated.mobileNumber = dto.mobileNumber;

        if (dto.medicalHistory !== undefined)
            updated.medicalHistory = dto.medicalHistory;

        if (dto.tshirtSize !== undefined)
            updated.tshirtSize = dto.tshirtSize;

        if (dto.raceCategory !== undefined) {
            updated.raceCategory =
                this.normalizeRaceCategory(dto.raceCategory);
        }

        if (dto.emergencyContactName !== undefined)
            updated.emergencyContactName =
                dto.emergencyContactName;

        if (dto.emergencyContactMobile !== undefined)
            updated.emergencyContactMobile =
                dto.emergencyContactMobile;

        if (dto.emergencyContactRelationship !== undefined)
            updated.emergencyContactRelationship =
                dto.emergencyContactRelationship;

        if (dto.waiverAccepted !== undefined)
            updated.waiverAccepted = dto.waiverAccepted;

        // CRITICAL FINANCIAL & SYSTEM INTEGRITY:
        // amount, paymentStatus, referenceNumber, gateway IDs, ticket IDs and system flags
        // CANNOT be altered through admin updates and are strictly preserved from existing.
        updated.amount = existing.amount;
        updated.paymentStatus = existing.paymentStatus;
        updated.referenceNumber = existing.referenceNumber;
        updated.razorpayOrderId = existing.razorpayOrderId;
        updated.razorpayPaymentId = existing.razorpayPaymentId;
        updated.ticketId = existing.ticketId;
        updated.finalRegistration = existing.finalRegistration;
        updated.emailSent = existing.emailSent;
        updated.userId = existing.userId;

        return updated;
    }

    public static normalizeRaceCategory(
        category: RaceCategory | string,
    ): string {
        if (!category) return '';
        const cat = category
            .toString()
            .toUpperCase()
            .replace(/\s/g, '');

        if (cat === '5KM' || cat === '5' || cat === 'KM_5') return 'KM_5';
        if (cat === '3KM' || cat === '3' || cat === 'KM_3') return 'KM_3';
        if (cat === '1.5KM' || cat === '1.5' || cat === 'KM_1_5') return 'KM_1_5';

        return cat;
    }
}
