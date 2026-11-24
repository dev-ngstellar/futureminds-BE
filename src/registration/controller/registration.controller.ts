// src/registration/controller/registration.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Param,
  NotFoundException,
  Put,
  Delete,
  Logger,
  HttpException,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { RegistrationService } from '../service/registration.service';
import { RegistrationDto } from '../dto/registration.dto';
import { UpdateRegistrationDto } from '../dto/update-registration.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ErrorCode, ErrorMessages } from '../../common/error-code';
import { Registration } from '@prisma/client';

@Controller('registrations')
export class RegistrationController {
  private readonly logger = new Logger(
    RegistrationController.name,
  );

  constructor(
    private readonly registrationService: RegistrationService,
  ) { }

  // ✅ CREATE REGISTRATION (PUBLIC)
  @Post()
  async create(@Body() data: RegistrationDto) {
    try {
      this.logger.log(
        `Creating registration for ${data.email}`,
      );

      const result = await this.registrationService.createRegistration(
        data,
      );

      return {
        message: 'Registration created successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        'Failed to create registration',
        error.stack,
      );

      if (error instanceof HttpException) throw error;

      throw new HttpException(
        ErrorMessages[
        ErrorCode.REGISTRATION_CREATION_FAILED
        ],
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ ADMIN STATS
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    try {
      this.logger.log('Fetching admin stats');

      const stats =
        await this.registrationService.getAdminStats();

      return {
        message: 'Stats fetched successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error(
        'Failed to fetch admin stats',
        error.stack,
      );

      if (error instanceof HttpException) throw error;

      throw new HttpException(
        ErrorMessages[
        ErrorCode.REGISTRATION_FETCH_FAILED
        ],
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ PAID CATEGORY STATS
  @Get('admin/stats/paid-category')
  @UseGuards(JwtAuthGuard)
  async getPaidCategoryStats() {
    try {
      this.logger.log('Fetching paid category stats');

      const stats = await this.registrationService.getPaidCategoryStats();

      return {
        message: 'Paid category stats fetched successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error(
        'Failed to fetch paid category stats',
        error.stack,
      );

      if (error instanceof HttpException) throw error;

      throw new HttpException(
        ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ EXPORT REGISTRATIONS AS CSV (ADMIN - PROTECTED)
  @Get('admin/export/csv')
  @UseGuards(JwtAuthGuard)
  async exportCsv(
    @Res() res: Response,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('raceCategory') raceCategory?: string,
    @Query('search') search?: string,
  ) {
    try {
      this.logger.log('Admin exporting registrations to CSV');
      const csvData = await this.registrationService.exportRegistrationsCsv({
        paymentStatus,
        raceCategory,
        search,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="marathon_registrations_${Date.now()}.csv"`,
      );
      return res.status(HttpStatus.OK).send(csvData);
    } catch (error) {
      this.logger.error('Failed to export CSV', error.stack);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to export registrations CSV',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ GET ALL REGISTRATIONS (ADMIN)
  // registration.controller.ts
  @Get('admin')
  @UseGuards(JwtAuthGuard)
  async getAll(
    @Query('paymentStatus') paymentStatus?: string,
    @Query('raceCategory') raceCategory?: string,
    @Query('finalRegistration') finalRegistration?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    try {
      this.logger.log('Fetching all registrations with filters');

      const result = await this.registrationService.getAllRegistrations({
        paymentStatus,
        raceCategory,
        finalRegistration,
        state,
        city,
        search,
        fromDate,
        toDate,
        page: Number(page),
        limit: Number(limit),
      });

      return {
        message: 'Registrations fetched successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to fetch registrations', error.stack);

      if (error instanceof HttpException) throw error;

      throw new HttpException(
        ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  // ✅ GET PUBLIC PASS (PUBLIC - SANITIZED PII)
  @Get('pass/:id')
  async getPublicPass(@Param('id') id: string) {
    try {
      this.logger.log(`Fetching public pass for registration id: ${id}`);

      const pass = await this.registrationService.getPublicPass(id);

      if (!pass) {
        throw new NotFoundException('Registration not found');
      }

      return {
        message: 'Pass details fetched successfully',
        data: pass,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch public pass for id: ${id}`,
        error.stack,
      );

      if (error instanceof HttpException) throw error;

      throw new HttpException(
        ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ GET REGISTRATION BY ID (ADMIN - PROTECTED)
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Param('id') id: string) {
    try {
      this.logger.log(
        `Fetching registration with id: ${id}`,
      );

      const registration =
        await this.registrationService.getRegistrationById(
          id,
        );

      if (!registration) {
        throw new NotFoundException(
          'Registration not found',
        );
      }

      return {
        message: 'Registration fetched successfully',
        data: registration,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch registration id: ${id}`,
        error.stack,
      );

      if (error instanceof HttpException) throw error;

      throw new HttpException(
        ErrorMessages[
        ErrorCode.REGISTRATION_FETCH_FAILED
        ],
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ UPDATE REGISTRATION (ADMIN)
  @Put('admin/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateRegistrationDto,
  ) {
    try {
      this.logger.log(
        `Updating registration with id: ${id}`,
      );

      const updated = await this.registrationService.updateRegistration(
        id,
        body,
      );

      return {
        message: 'Registration updated successfully',
        data: updated,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update registration id: ${id}`,
        error.stack,
      );

      if (error instanceof HttpException) throw error;

      throw new HttpException(
        ErrorMessages[
        ErrorCode.REGISTRATION_UPDATE_FAILED
        ],
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ DELETE REGISTRATION (ADMIN)
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    try {
      this.logger.log(
        `Deleting registration with id: ${id}`,
      );

      const deleted =
        await this.registrationService.deleteRegistration(
          id,
        );

      return {
        message: 'Registration deleted successfully',
        data: deleted,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete registration id: ${id}`,
        error.stack,
      );

      if (error instanceof HttpException) throw error;

      throw new HttpException(
        ErrorMessages[
        ErrorCode.REGISTRATION_DELETE_FAILED
        ],
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
