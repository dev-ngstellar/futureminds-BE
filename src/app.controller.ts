import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
    @Get()
    getHealth() {
        return {
            status: 'ok',
            message: 'Future Minds Foundation Marathon Backend API',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
        };
    }

    @Get('health')
    healthCheck() {
        return {
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        };
    }

    // ✅ DYNAMIC MARATHON EVENT METADATA
    @Get('marathon/config')
    getMarathonConfig() {
        return {
            status: 'ok',
            data: {
                title: 'Future Minds Foundation Marathon',
                organizer: 'Future Minds Foundation',
                eventDate: '2027-02-14T05:30:00.000Z',
                eventDateFormatted: 'Sunday, 14 February 2027',
                venue: 'Ayyappanthangal, Chennai',
                reportingTime: '05:00 AM',
                isRegistrationOpen: true,
                contactPerson: 'Dr. Ramesh Nivash, BE, MBA, MA, MSc',
                categories: [
                    {
                        code: '1.5 KM',
                        display: '1.5 KM Family Fun Run',
                        distance: '1.5 KM',
                        amount: 350,
                    },
                    {
                        code: '3 KM',
                        display: '3 KM Dream Run',
                        distance: '3 KM',
                        amount: 350,
                    },
                    {
                        code: '5 KM',
                        display: '5 KM Challenge',
                        distance: '5 KM',
                        amount: 400,
                    },
                ],
            },
        };
    }
}
