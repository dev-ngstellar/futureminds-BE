// src/registration/service/registration.service.ts
import {
    Injectable,
    HttpException,
    HttpStatus,
    Logger,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../../common/error-code';
import { RegistrationDto } from '../dto/registration.dto';
import { UpdateRegistrationDto } from '../dto/update-registration.dto';
import { RegistrationRepository } from '../repository/registration.repository';
import { PaymentService } from '../../payment/service/payment.service';
import { RegistrationMapper } from '../../common/utils/registration.mapper.service';
import { RaceCategory, RaceAmount } from '../../common/enums/race-category.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class RegistrationService {
    private readonly logger = new Logger(RegistrationService.name);

    constructor(
        private readonly registrationRepository: RegistrationRepository,
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
        @Inject(forwardRef(() => PaymentService))
        private readonly paymentService: PaymentService,
    ) { }

    // ✅ ADMIN STATS
    async getAdminStats() {
        try {
            const totalCount = await this.registrationRepository.getTotalPaidCount();
            const totalRevenue = await this.registrationRepository.getTotalRevenue();
            return { totalCount, totalRevenue };
        } catch (error) {
            this.logger.error('Failed to fetch admin stats', error.stack);
            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ✅ PAID CATEGORY STATS
    async getPaidCategoryStats() {
        try {
            const stats = await this.registrationRepository.getPaidCategoryStats();
            return stats.map(stat => ({
                category: this.formatRaceCategory(stat.category),
                count: stat.count
            }));
        } catch (error) {
            this.logger.error('Failed to fetch paid category stats', error.stack);
            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ✅ GET ALL
    // registration.service.ts
    async getAllRegistrations(filters: any) {
        try {
            if (filters.raceCategory && typeof filters.raceCategory === 'string') {
                const parts = filters.raceCategory.split(',').map((c) => c.trim());
                const normalized = parts.map(
                    (p) => this.normalizeRaceCategory(p).dbValue,
                );
                filters.raceCategory = normalized;
            }

            return await this.registrationRepository.getAll(filters);
        } catch (error) {
            this.logger.error('Failed to fetch registrations', error.stack);
            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ✅ GET BY ID
    async getRegistrationById(id: string) {
        try {
            return await this.registrationRepository.getById(id);
        } catch (error) {
            this.logger.error(
                `Failed to fetch registration id: ${id}`,
                error.stack,
            );
            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ✅ GET PUBLIC PASS (SANITIZED PII - Omits address, medicalHistory, emergencyContact, DOB)
    async getPublicPass(id: string) {
        try {
            const reg = await this.registrationRepository.getById(id);
            if (!reg) return null;

            return {
                id: reg.id,
                referenceNumber: reg.referenceNumber,
                name: reg.name,
                raceCategory: this.formatRaceCategory(reg.raceCategory),
                tshirtSize: reg.tshirtSize,
                paymentStatus: reg.paymentStatus,
                amount: reg.amount,
                finalRegistration: reg.finalRegistration,
                emailSent: reg.emailSent,
                createdAt: reg.createdAt,
            };
        } catch (error) {
            this.logger.error(
                `Failed to fetch public pass for id: ${id}`,
                error.stack,
            );
            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ✅ EXPORT REGISTRATIONS AS CSV (ADMIN - FORMULA INJECTION SANITIZED)
    async exportRegistrationsCsv(filters: any): Promise<string> {
        try {
            const result = await this.registrationRepository.getAll({
                ...filters,
                limit: 10000,
                page: 1,
            });

            const sanitize = (val: any) => {
                if (val === null || val === undefined) return '""';
                let str = String(val).replace(/"/g, '""');
                // Neutralize spreadsheet formula injection (=, +, -, @, tab, cr)
                if (/^[=+\-@\t\r]/.test(str)) {
                    str = `'${str}`;
                }
                return `"${str}"`;
            };

            const headers = [
                'Reference Number',
                'Name',
                'Email',
                'Mobile Number',
                'Gender',
                'Date of Birth',
                'Age',
                'Blood Group',
                'T-Shirt Size',
                'Race Category',
                'Amount',
                'Payment Status',
                'Emergency Contact Name',
                'Emergency Contact Mobile',
                'Address',
                'City',
                'State',
                'Pincode',
                'Razorpay Order ID',
                'Razorpay Payment ID',
                'Waiver Accepted',
                'Email Sent',
                'Registration Date',
            ];

            const csvRows = [headers.join(',')];

            for (const r of result.items) {
                const row = [
                    sanitize(r.referenceNumber || ''),
                    sanitize(r.name),
                    sanitize(r.email),
                    sanitize(r.mobileNumber),
                    sanitize(r.gender),
                    sanitize(r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : ''),
                    sanitize(r.age),
                    sanitize(r.bloodGroup || ''),
                    sanitize(r.tshirtSize),
                    sanitize(this.formatRaceCategory(r.raceCategory)),
                    sanitize(r.amount),
                    sanitize(r.paymentStatus),
                    sanitize(r.emergencyContactName),
                    sanitize(r.emergencyContactMobile),
                    sanitize(r.presentAddress),
                    sanitize(r.city),
                    sanitize(r.state),
                    sanitize(r.pincode),
                    sanitize(r.razorpayOrderId || ''),
                    sanitize(r.razorpayPaymentId || ''),
                    sanitize(r.waiverAccepted ? 'Yes' : 'No'),
                    sanitize(r.emailSent ? 'Yes' : 'No'),
                    sanitize(r.createdAt ? new Date(r.createdAt).toISOString() : ''),
                ];
                csvRows.push(row.join(','));
            }

            return csvRows.join('\r\n');
        } catch (error) {
            this.logger.error('Failed to export registrations CSV', error.stack);
            throw new HttpException('Failed to export registrations CSV', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // 🔧 NORMALIZE CATEGORY
    private normalizeRaceCategory(category: string): {
        dbValue: string;
        amount: number;
        display: string;
    } {
        const cat = category.toUpperCase().replace(/\s/g, '');

        if (cat === '5KM' || cat === '5' || cat === 'KM_5')
            return { dbValue: RaceCategory.KM_5, amount: RaceAmount.KM_5, display: '5 KM' };

        if (cat === '3KM' || cat === '3' || cat === 'KM_3') {
            return { dbValue: RaceCategory.KM_3, amount: RaceAmount.KM_3, display: '3 KM' };
        }

        if (cat === '1.5KM' || cat === '1.5' || cat === 'KM_1_5' || cat === 'KM_1.5') {
            return { dbValue: RaceCategory.KM_1_5, amount: RaceAmount.KM_1_5, display: '1.5 KM' };
        }

        return { dbValue: category, amount: 0, display: category };
    }

    // 🔧 FORMAT CATEGORY FOR DISPLAY
    public formatRaceCategory(dbValue: string): string {
        switch (dbValue) {
            case RaceCategory.KM_5: return RaceCategory.KM_5;
            case RaceCategory.KM_3: return RaceCategory.KM_3;
            case RaceCategory.KM_1_5: return RaceCategory.KM_1_5;
            default: return dbValue;
        }
    }

    async createRegistration(dto: RegistrationDto) {
        this.logger.log(`Creating registration for ${dto.email}`);

        try {
            // const emailExists =
            //     await this.registrationRepository.existsByEmail(dto.email);
            // if (emailExists) {
            //     throw new HttpException(
            //         ErrorMessages[ErrorCode.REGISTRATION_EMAIL_EXISTS],
            //         HttpStatus.CONFLICT,
            //     );
            // }

            // const mobileExists =
            //     await this.registrationRepository.existsByMobile(
            //         dto.mobileNumber,
            //     );
            // if (mobileExists) {
            //     throw new HttpException(
            //         ErrorMessages[ErrorCode.REGISTRATION_MOBILE_EXISTS],
            //         HttpStatus.CONFLICT,
            //     );
            // }

            const category = this.normalizeRaceCategory(dto.raceCategory);

            // referenceNumber is set only after payment success in finalizeRegistration
            const registration =
                await this.registrationRepository.create({
                    ...dto,
                    amount: category.amount,
                    raceCategory: category.dbValue,
                    dateOfBirth: new Date(dto.dateOfBirth),
                    paymentStatus: 'PENDING',
                    razorpayOrderId: null,
                    emailSent: false,
                } as any)

            return {
                ...registration,
                raceCategory: category.display,
            };
        } catch (error) {
            if (error instanceof HttpException) throw error;

            this.logger.error(
                'Registration creation failed',
                error.stack,
            );
            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_CREATION_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 🔗 CREATE RAZORPAY ORDER
    // const order = await this.paymentService.createOrder(
    //     dto.email,
    //     category.amount,
    // );

    // ✅ SHARED IDEMPOTENT FINALIZATION SERVICE
    async finalizeRegistration(
        razorpayOrderId: string,
        razorpayPaymentId: string,
        options?: { webhookId?: string; razorpaySignature?: string },
    ): Promise<{ registration: any; newlyFinalized: boolean }> {
        try {
            this.logger.log(
                `Finalizing registration for orderId: ${razorpayOrderId}`,
            );

            // 1️⃣ Database Transaction: Idempotency Lock, Status Update, & Atomic Reference Number
            const finalResult = await this.prisma.$transaction(async (tx) => {
                const registration = await tx.registration.findUnique({
                    where: { razorpayOrderId },
                });

                if (!registration) {
                    throw new HttpException(
                        ErrorMessages[ErrorCode.REGISTRATION_NOT_FOUND],
                        HttpStatus.NOT_FOUND,
                    );
                }

                // Idempotency check: If already finalized, exit early without duplicating
                if (registration.finalRegistration === true && registration.paymentStatus === 'PAID') {
                    this.logger.warn(
                        `Registration already finalized for orderId: ${razorpayOrderId}`,
                    );
                    return { registration, newlyFinalized: false };
                }

                // Concurrency-safe atomic reference number allocation inside locked transaction
                const referenceNumber =
                    await this.registrationRepository.getNextReferenceNumberAtomic(
                        tx,
                        registration.raceCategory,
                    );

                // Update Payment record
                await tx.payment.updateMany({
                    where: { razorpayOrderId },
                    data: {
                        razorpayPaymentId,
                        ...(options?.razorpaySignature ? { razorpaySignature: options.razorpaySignature } : {}),
                        status: 'PAID',
                        verified: true,
                    },
                });

                // Update Registration record
                const updatedRegistration = await tx.registration.update({
                    where: { id: registration.id },
                    data: {
                        paymentStatus: 'PAID',
                        razorpayPaymentId,
                        referenceNumber,
                        finalRegistration: true,
                    },
                });

                return { registration: updatedRegistration, newlyFinalized: true };
            });

            // 2️⃣ Confirmation Email: Sent strictly on newly finalized records
            if (finalResult.newlyFinalized && !finalResult.registration.emailSent) {
                try {
                    const formattedCategory = this.formatRaceCategory(
                        finalResult.registration.raceCategory,
                    );

                    this.logger.log(`Dispatching confirmation ticket email to ${finalResult.registration.email}`);
                    await this.mailService.sendTicketId(
                        finalResult.registration.email,
                        finalResult.registration.referenceNumber,
                        finalResult.registration.amount.toString(),
                        {
                            name: '3rd Edition Ayyappanthangal Marathon',
                            venue: 'Ayyappanthangal, Chennai',
                            date: 'Sunday, 14 February 2027',
                            category: formattedCategory,
                            userName: finalResult.registration.name,
                        },
                    );

                    await this.updateEmailStatus(finalResult.registration.id, true);
                    finalResult.registration.emailSent = true;
                } catch (mailError) {
                    this.logger.error(
                        `Failed to send ticket email to ${finalResult.registration.email}: ${mailError.message}`,
                    );
                    // Do not fail the payment; retain paid registration for email retry
                }
            }

            return finalResult;
        } catch (error) {
            if (error instanceof HttpException) throw error;

            this.logger.error(
                'Failed to finalize registration',
                error.stack,
            );
            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_CREATION_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Finalize registration when we only have registrationId (e.g. from webhook notes).
     * Same logic as finalizeRegistration: assign referenceNumber on payment success (single place).
     */
    async finalizeRegistrationByRegistrationId(
        registrationId: string,
        razorpayPaymentId: string,
    ): Promise<{ registration: any; newlyFinalized: boolean }> {
        try {
            this.logger.log(
                `Finalizing registration by id | registrationId=${registrationId}`,
            );

            const finalResult = await this.prisma.$transaction(async (tx) => {
                const registration = await tx.registration.findUnique({
                    where: { id: registrationId },
                });

                if (!registration) {
                    throw new HttpException(
                        ErrorMessages[ErrorCode.REGISTRATION_NOT_FOUND],
                        HttpStatus.NOT_FOUND,
                    );
                }

                if (registration.finalRegistration === true && registration.paymentStatus === 'PAID') {
                    this.logger.warn(
                        `Registration already finalized | registrationId=${registrationId}`,
                    );
                    return { registration, newlyFinalized: false };
                }

                const referenceNumber =
                    await this.registrationRepository.getNextReferenceNumberAtomic(
                        tx,
                        registration.raceCategory,
                    );

                // Update Payment record
                await tx.payment.updateMany({
                    where: { registrationId },
                    data: {
                        razorpayPaymentId,
                        status: 'PAID',
                        verified: true,
                    },
                });

                const updatedRegistration = await tx.registration.update({
                    where: { id: registration.id },
                    data: {
                        paymentStatus: 'PAID',
                        razorpayPaymentId,
                        referenceNumber,
                        finalRegistration: true,
                    },
                });

                return { registration: updatedRegistration, newlyFinalized: true };
            });

            if (finalResult.newlyFinalized && !finalResult.registration.emailSent) {
                try {
                    const formattedCategory = this.formatRaceCategory(
                        finalResult.registration.raceCategory,
                    );

                    await this.mailService.sendTicketId(
                        finalResult.registration.email,
                        finalResult.registration.referenceNumber,
                        finalResult.registration.amount.toString(),
                        {
                            name: '3rd Edition Ayyappanthangal Marathon',
                            venue: 'Ayyappanthangal, Chennai',
                            date: 'Sunday, 14 February 2027',
                            category: formattedCategory,
                            userName: finalResult.registration.name,
                        },
                    );

                    await this.updateEmailStatus(finalResult.registration.id, true);
                    finalResult.registration.emailSent = true;
                } catch (mailError) {
                    this.logger.error(
                        `Failed to send ticket email to ${finalResult.registration.email}: ${mailError.message}`,
                    );
                }
            }

            return finalResult;
        } catch (error) {
            if (error instanceof HttpException) throw error;

            this.logger.error(
                'Failed to finalize registration by id',
                error.stack,
            );
            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_CREATION_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 📧 EMAIL STATUS
    async updateEmailStatus(id: string, status: boolean) {
        try {
            return await this.registrationRepository.update(id, {
                emailSent: status,
            });
        } catch (error) {
            this.logger.error(
                `Failed to update email status for ${id}`,
                error.stack,
            );
            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_UPDATE_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async updateRegistration(
        id: string,
        data: UpdateRegistrationDto,
    ) {
        try {
            this.logger.log(`Updating registration id: ${id}`);

            return await this.registrationRepository.updateRegistrationAdminAtomic(
                id,
                data,
            );
        } catch (error) {
            if (error instanceof HttpException) throw error;

            this.logger.error(
                `Failed to update registration id: ${id}`,
                error.stack,
            );

            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_UPDATE_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async deleteRegistration(id: string) {
        try {
            this.logger.log(`Cancelling registration id: ${id}`);

            const result =
                await this.registrationRepository.cancelRegistrationAtomic(id);

            if (result.status === 'NOT_FOUND') {
                throw new HttpException(
                    ErrorMessages[ErrorCode.REGISTRATION_NOT_FOUND],
                    HttpStatus.NOT_FOUND,
                );
            }

            if (result.status === 'PAID') {
                throw new HttpException(
                    'Paid registrations cannot be cancelled through this endpoint. Refunds must be handled separately.',
                    HttpStatus.CONFLICT,
                );
            }

            return result.registration;
        } catch (error) {
            if (error instanceof HttpException) throw error;

            this.logger.error(
                `Failed to delete registration id: ${id}`,
                error.stack,
            );

            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_DELETE_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}