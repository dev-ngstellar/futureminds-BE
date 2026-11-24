import {
    Injectable,
    InternalServerErrorException,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Registration } from '../entity/registration.entity';
import { Prisma } from '@prisma/client';
import { EntityMapper } from '../../common/utils/entity.mapper.service';
import { UpdateRegistrationDto } from '../dto/update-registration.dto';
import { RegistrationMapper } from '../../common/utils/registration.mapper.service';
import { ErrorCode, ErrorMessages } from '../../common/error-code';


@Injectable()
export class RegistrationRepository {
    private readonly logger = new Logger(RegistrationRepository.name);

    constructor(private readonly prisma: PrismaService) { }

    async create(
        data: Prisma.RegistrationCreateInput,
    ): Promise<Registration> {
        try {
            this.logger.log('Creating new registration');

            const result =
                await this.prisma.registration.create({ data });

            return EntityMapper.toEntity(Registration, result);
        } catch (error) {
            this.logger.error(
                'Failed to create registration',
                error.stack,
            );
            throw new InternalServerErrorException(
                `Unable to create registration: ${error.message}`,
            );
        }
    }

    async getById(id: string): Promise<Registration | null> {
        try {
            this.logger.log(`Fetching registration by id: ${id}`);

            const result =
                await this.prisma.registration.findUnique({
                    where: { id },
                });

            return result
                ? EntityMapper.toEntity(Registration, result)
                : null;
        } catch (error) {
            this.logger.error(
                `Failed to fetch registration by id: ${id}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch registration',
            );
        }
    }

    // registration.repository.ts
    async getAll(filters?: {
        paymentStatus?: string;
        raceCategory?: string | string[];
        finalRegistration?: string;
        state?: string;
        city?: string;
        search?: string;
        fromDate?: string;
        toDate?: string;
        page?: number;
        limit?: number;
    }): Promise<any> {
        try {
            this.logger.log('Fetching all registrations with filters');

            const {
                paymentStatus,
                raceCategory,
                finalRegistration,
                state,
                city,
                search,
                fromDate,
                toDate,
                page = 1,
                limit = 20,
            } = filters || {};

            const pageNum = Math.max(1, Math.floor(page));
            const limitNum = Math.max(1, Math.floor(limit));

            const where: Prisma.RegistrationWhereInput = {};

            if (paymentStatus) {
                where.paymentStatus = paymentStatus;
            }

            if (raceCategory) {
                if (Array.isArray(raceCategory)) {
                    where.raceCategory = { in: raceCategory };
                } else if (typeof raceCategory === 'string' && raceCategory.includes(',')) {
                    where.raceCategory = { in: raceCategory.split(',').map(c => c.trim()) };
                } else {
                    where.raceCategory = raceCategory;
                }
            }

            if (finalRegistration !== undefined) {
                where.finalRegistration = finalRegistration === 'true';
            }

            if (state) {
                where.state = {
                    contains: state,
                    mode: 'insensitive',
                };
            }

            if (city) {
                where.city = {
                    contains: city,
                    mode: 'insensitive',
                };
            }

            if (fromDate || toDate) {
                where.createdAt = {};
                if (fromDate) where.createdAt.gte = new Date(fromDate);
                if (toDate) where.createdAt.lte = new Date(toDate);
            }

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { mobileNumber: { contains: search } },
                ];
            }

            const [results, total] = await Promise.all([
                this.prisma.registration.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip: (pageNum - 1) * limitNum,
                    take: limitNum,
                }),
                this.prisma.registration.count({ where }),
            ]);

            const totalPages = Math.ceil(total / limitNum);

            return {
                items: EntityMapper.toEntities(Registration, results),
                pageInfo: {
                    totalResults: total,
                    pageCount: totalPages,
                    resultsPerPage: limitNum,
                    currentPage: pageNum,
                    totalPages: totalPages,
                    hasNextPage: pageNum < totalPages,
                    hasPrevPage: pageNum > 1,
                    nextPage: pageNum < totalPages ? pageNum + 1 : null,
                    prevPage: pageNum > 1 ? pageNum - 1 : null,
                },
            };
        } catch (error) {
            this.logger.error(
                `Failed to fetch registrations with filters: ${error.message}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch registrations',
            );
        }
    }

    async update(
        id: string,
        data: Partial<Registration>,
    ): Promise<Registration> {
        try {
            this.logger.log(`Updating registration id: ${id}`);

            const result =
                await this.prisma.registration.update({
                    where: { id },
                    data,
                });

            return EntityMapper.toEntity(Registration, result);
        } catch (error) {
            this.logger.error(
                `Failed to update registration id: ${id}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to update registration',
            );
        }
    }

    async delete(id: string): Promise<Registration> {
        try {
            this.logger.log(`Deleting registration id: ${id}`);

            const result =
                await this.prisma.registration.delete({
                    where: { id },
                });

            return EntityMapper.toEntity(Registration, result);
        } catch (error) {
            this.logger.error(
                `Failed to delete registration id: ${id}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to delete registration',
            );
        }
    }

    async getTotalCount(): Promise<number> {
        try {
            this.logger.log('Fetching total registration count');

            return await this.prisma.registration.count();
        } catch (error) {
            this.logger.error(
                'Failed to fetch total registration count',
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch registration count',
            );
        }
    }

    async getTotalPaidCount(): Promise<number> {
        try {
            this.logger.log('Fetching total registration count');

            return await this.prisma.registration.count({
                where: { paymentStatus: 'PAID' },
            });
        } catch (error) {
            this.logger.error(
                'Failed to fetch total paid registration count',
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch registration count',
            );
        }
    }

    async getTotalRevenue(): Promise<number> {
        try {
            this.logger.log('Fetching total revenue');

            const result = await this.prisma.registration.aggregate({
                _sum: { amount: true },
                where: { paymentStatus: 'PAID' },
            });

            return result._sum.amount ?? 0;
        } catch (error) {
            this.logger.error(
                'Failed to fetch total revenue',
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch total revenue',
            );
        }
    }

    // ✅ ATOMIC, CONCURRENCY-SAFE, NUMERIC-SORTED REFERENCE NUMBER GENERATION
    async getNextReferenceNumberAtomic(
        client: Prisma.TransactionClient | PrismaService,
        raceCategoryDbValue: string,
    ): Promise<string> {
        try {
            this.logger.log(
                `Computing atomic next reference number for category=${raceCategoryDbValue}`,
            );

            // Category base series
            let baseNumber: number;
            const norm = (raceCategoryDbValue || '').toUpperCase().replace(/\s/g, '');
            if (norm.includes('1.5') || norm.includes('1_5')) {
                baseNumber = 1100;
            } else if (norm.includes('3')) {
                baseNumber = 3100;
            } else if (norm.includes('5')) {
                baseNumber = 5100;
            } else {
                baseNumber = 1000;
            }

            // 1. Transaction-level PostgreSQL advisory lock derived from category name
            // Serializes concurrent allocations for the same category
            await (client as any).$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'cat_seq_lock_' + raceCategoryDbValue}))`;

            // 2. Numerical maximum search (avoids lexicographical string sorting flaw where "5109" > "51010")
            const rows = await (client as any).$queryRaw`
                SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace("referenceNumber", '\\D', '', 'g'), '') AS INTEGER)), 0) as max_num
                FROM "Registration"
                WHERE "raceCategory" = ${raceCategoryDbValue}
                  AND "referenceNumber" IS NOT NULL
            `;

            const maxExisting = Number(rows[0]?.max_num || 0);
            const baseline = Math.max(maxExisting, baseNumber);
            return String(baseline + 1);
        } catch (error) {
            this.logger.error(
                `Failed to compute next reference number for category=${raceCategoryDbValue}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to compute next reference number',
            );
        }
    }

    // Get next reference number for a given race category
    async getNextReferenceNumber(raceCategoryDbValue: string): Promise<string> {
        return this.getNextReferenceNumberAtomic(this.prisma, raceCategoryDbValue);
    }

    async existsByEmail(email: string): Promise<boolean> {
        try {
            this.logger.log(`Checking registration by email: ${email}`);

            const count = await this.prisma.registration.count({
                where: { email },
            });

            return count > 0;
        } catch (error) {
            this.logger.error(
                `Failed to check registration by email: ${email}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to verify email',
            );
        }
    }

    async existsByMobile(mobileNumber: string): Promise<boolean> {
        try {
            this.logger.log(
                `Checking registration by mobile: ${mobileNumber}`,
            );

            const count = await this.prisma.registration.count({
                where: { mobileNumber },
            });

            return count > 0;
        } catch (error) {
            this.logger.error(
                `Failed to check registration by mobile: ${mobileNumber}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to verify mobile number',
            );
        }
    }

    async findByOrderId(orderId: string): Promise<Registration | null> {
        try {
            this.logger.log(`Finding registration by order id: ${orderId}`);

            const result = await this.prisma.registration.findUnique({
                where: { razorpayOrderId: orderId },
            });

            return result
                ? EntityMapper.toEntity(Registration, result)
                : null;
        } catch (error) {
            this.logger.error(
                `Failed to find registration by order id: ${orderId}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to find registration',
            );
        }
    }

    async getPaidCount(): Promise<number> {
        try {
            this.logger.log('Fetching paid registrations count');

            return await this.prisma.registration.count({
                where: { paymentStatus: 'PAID' },
            });
        } catch (error) {
            this.logger.error(
                'Failed to fetch paid registrations count',
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch paid registrations count',
            );
        }
    }

    async getPaidCategoryStats(): Promise<
        { category: string; count: number }[]
    > {
        try {
            this.logger.log('Fetching paid registration stats by race category');

            // Check what we have
            const totalCount = await this.prisma.registration.count();
            const paidCount = await this.prisma.registration.count({
                where: { paymentStatus: 'PAID' }
            });
            const finalCount = await this.prisma.registration.count({
                where: { finalRegistration: true }
            });

            this.logger.log(`Database counts - Total: ${totalCount}, Paid: ${paidCount}, Final: ${finalCount}`);

            const result = await this.prisma.registration.groupBy({
                by: ['raceCategory'],
                where: {
                    paymentStatus: 'PAID'
                },
                _count: {
                    raceCategory: true,
                },
            });

            this.logger.log(`Grouped result count: ${result.length}`);
            if (result.length > 0) {
                this.logger.log(`Categories: ${result.map(r => `${r.raceCategory}:${r._count.raceCategory}`).join(', ')}`);
            }

            return result.map((item) => ({
                category: item.raceCategory,
                count: item._count.raceCategory,
            }));
        } catch (error) {
            this.logger.error(
                'Failed to fetch paid registration stats by race category',
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch paid registration stats by race category',
            );
        }
    }

    async cancelRegistrationAtomic(id: string): Promise<{
        status: 'NOT_FOUND' | 'PAID' | 'CANCELLED';
        registration?: Registration;
    }> {
        try {
            this.logger.log(`Executing atomic cancellation check for registration id: ${id}`);
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.registration.findUnique({
                    where: { id },
                });

                if (!existing) {
                    return { status: 'NOT_FOUND' };
                }

                if (existing.paymentStatus === 'PAID') {
                    return {
                        status: 'PAID',
                        registration: EntityMapper.toEntity(Registration, existing),
                    };
                }

                // Atomic conditional update ensuring paymentStatus is not PAID
                const updateResult = await tx.registration.updateMany({
                    where: {
                        id,
                        paymentStatus: { not: 'PAID' },
                    },
                    data: {
                        paymentStatus: 'CANCELLED',
                    },
                });

                if (updateResult.count === 0) {
                    // Re-check in case status transitioned to PAID concurrently
                    const recheck = await tx.registration.findUnique({ where: { id } });
                    if (recheck?.paymentStatus === 'PAID') {
                        return {
                            status: 'PAID',
                            registration: EntityMapper.toEntity(Registration, recheck),
                        };
                    }
                }

                const updated = await tx.registration.findUnique({
                    where: { id },
                });

                return {
                    status: 'CANCELLED',
                    registration: EntityMapper.toEntity(Registration, updated),
                };
            });
        } catch (error) {
            this.logger.error(
                `Failed during atomic cancellation for registration id: ${id}`,
                error.stack,
            );
            throw new InternalServerErrorException('Unable to cancel registration');
        }
    }

    async updateRegistrationAdminAtomic(
        id: string,
        data: Partial<UpdateRegistrationDto>,
    ): Promise<Registration> {
        try {
            this.logger.log(`Executing atomic admin update for registration id: ${id}`);
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.registration.findUnique({
                    where: { id },
                });

                if (!existing) {
                    throw new HttpException(
                        ErrorMessages[ErrorCode.REGISTRATION_NOT_FOUND],
                        HttpStatus.NOT_FOUND,
                    );
                }

                // If raceCategory is being changed, verify registration is NOT PAID
                if (data.raceCategory !== undefined) {
                    const normNew = RegistrationMapper.normalizeRaceCategory(data.raceCategory);
                    const normExisting = RegistrationMapper.normalizeRaceCategory(existing.raceCategory);

                    if (normNew !== normExisting && existing.paymentStatus === 'PAID') {
                        throw new HttpException(
                            'Race category cannot be changed for paid registrations',
                            HttpStatus.CONFLICT,
                        );
                    }
                }

                // Strictly map permitted fields, ignoring and preserving financial/system fields
                const updatedData = RegistrationMapper.applyUpdate(existing, data);

                // Whitelisted fields update only - NO financial or system fields passed
                const updatePayload: Prisma.RegistrationUpdateInput = {};
                if (data.name !== undefined) updatePayload.name = updatedData.name;
                if (data.email !== undefined) updatePayload.email = updatedData.email;
                if (data.gender !== undefined) updatePayload.gender = updatedData.gender;
                if (data.dateOfBirth !== undefined) updatePayload.dateOfBirth = updatedData.dateOfBirth;
                if (data.age !== undefined) updatePayload.age = updatedData.age;
                if (data.presentAddress !== undefined) updatePayload.presentAddress = updatedData.presentAddress;
                if (data.state !== undefined) updatePayload.state = updatedData.state;
                if (data.city !== undefined) updatePayload.city = updatedData.city;
                if (data.pincode !== undefined) updatePayload.pincode = updatedData.pincode;
                if (data.mobileNumber !== undefined) updatePayload.mobileNumber = updatedData.mobileNumber;
                if (data.medicalHistory !== undefined) updatePayload.medicalHistory = updatedData.medicalHistory;
                if (data.tshirtSize !== undefined) updatePayload.tshirtSize = updatedData.tshirtSize;
                if (data.emergencyContactName !== undefined) updatePayload.emergencyContactName = updatedData.emergencyContactName;
                if (data.emergencyContactMobile !== undefined) updatePayload.emergencyContactMobile = updatedData.emergencyContactMobile;
                if (data.waiverAccepted !== undefined) updatePayload.waiverAccepted = updatedData.waiverAccepted;

                // Category update if changed
                if (data.raceCategory !== undefined) {
                    const normNew = RegistrationMapper.normalizeRaceCategory(data.raceCategory);
                    const normExisting = RegistrationMapper.normalizeRaceCategory(existing.raceCategory);
                    if (normNew !== normExisting) {
                        // Concurrency guard: update only if paymentStatus != 'PAID'
                        const categoryUpdateResult = await tx.registration.updateMany({
                            where: {
                                id,
                                paymentStatus: { not: 'PAID' },
                            },
                            data: {
                                raceCategory: updatedData.raceCategory,
                            },
                        });

                        if (categoryUpdateResult.count === 0) {
                            // Check if concurrently marked PAID
                            const recheck = await tx.registration.findUnique({ where: { id } });
                            if (recheck?.paymentStatus === 'PAID') {
                                throw new HttpException(
                                    'Race category cannot be changed for paid registrations',
                                    HttpStatus.CONFLICT,
                                );
                            }
                        }
                    }
                }

                const result = await tx.registration.update({
                    where: { id },
                    data: updatePayload,
                });

                return EntityMapper.toEntity(Registration, result);
            });
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `Failed to atomically update registration id: ${id}`,
                error.stack,
            );
            throw new InternalServerErrorException('Unable to update registration');
        }
    }
}
