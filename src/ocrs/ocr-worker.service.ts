import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import * as Tesseract from 'tesseract.js';
import axios from 'axios';
import {
    OcrResult,
    ExpenseData,
    OcrCompletedEvent,
    OcrJobStatus,
} from './types/ocr-types';

@Injectable()
export class OcrWorkerService {
    private readonly logger = new Logger(OcrWorkerService.name);

    constructor(
        private prisma: PrismaService,
        @Inject('RABBITMQ_CLIENT') private rabbitClient: ClientProxy,
    ) { }

    async processOcrJob(jobId: string): Promise<void> {
        this.logger.log(`Starting OCR processing for job ${jobId}`);

        try {
            // Update status to processing
            await this.updateJobStatus(jobId, OcrJobStatus.PROCESSING);

            // Get job details
            const job = await this.prisma.ocrJob.findUnique({
                where: { id: jobId },
            });

            if (!job) {
                throw new Error(`Job ${jobId} not found`);
            }

            // Perform OCR
            const ocrResult = await this.performOcr(job.fileUrl);
            this.logger.log(
                `OCR completed with confidence: ${ocrResult.confidence}%`,
            );

            // Parse OCR text to extract expense data
            const expenseData = await this.parseOcrText(
                ocrResult.text,
                ocrResult.confidence,
            );
            this.logger.log(`Parsed expense data: ${JSON.stringify(expenseData)}`);

            // Save result to database
            await this.prisma.ocrJob.update({
                where: { id: jobId },
                data: {
                    status: OcrJobStatus.COMPLETED,
                    resultJson: JSON.parse(JSON.stringify({
                        rawText: ocrResult.text,
                        confidence: ocrResult.confidence,
                        expenseData: {
                            amount: expenseData.amount,
                            description: expenseData.description,
                            spentAt: expenseData.spentAt.toISOString(),
                            category: expenseData.category,
                            confidence: expenseData.confidence,
                        },
                    })),
                    completedAt: new Date(),
                },
            });

            // Emit event to expense service
            await this.emitOcrCompleted(jobId, job.userId, expenseData, job.fileUrl);

            this.logger.log(`Job ${jobId} completed successfully`);
        } catch (error) {
            this.logger.error(`Job ${jobId} failed: ${error.message}`, error.stack);

            await this.prisma.ocrJob.update({
                where: { id: jobId },
                data: {
                    status: OcrJobStatus.FAILED,
                    errorMessage: error.message,
                    completedAt: new Date(),
                },
            });
        }
    }

    private async performOcr(fileUrl: string): Promise<OcrResult> {
        this.logger.log(`Downloading image from: ${fileUrl}`);

        try {
            // Download image
            const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30 seconds timeout
            });

            const imageBuffer = Buffer.from(response.data);

            // Perform OCR with Tesseract.js
            this.logger.log('Running Tesseract OCR...');
            const result = await Tesseract.recognize(imageBuffer, 'eng+vie', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        this.logger.debug(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
                    }
                },
            });

            return {
                text: result.data.text,
                confidence: result.data.confidence,
            };
        } catch (error) {
            throw new Error(`Failed to perform OCR: ${error.message}`);
        }
    }

    private async parseOcrText(
        text: string,
        confidence: number,
    ): Promise<ExpenseData> {
        this.logger.log('Parsing OCR text to extract expense data...');

        // Regular expressions for parsing
        const amountRegex = /(?:total|amount|tổng|thanh toán)[:\s]*([0-9,\.]+)/i;
        const dateRegex = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/;
        const currencyRegex = /([0-9,\.]+)\s*(?:đ|vnd|₫|usd|\$)/i;

        // Extract amount
        let amount = 0;
        const amountMatch = text.match(amountRegex) || text.match(currencyRegex);
        if (amountMatch) {
            const amountStr = amountMatch[1].replace(/[,\.]/g, '');
            amount = parseFloat(amountStr) || 0;
        }

        // Extract date
        let spentAt = new Date();
        const dateMatch = text.match(dateRegex);
        if (dateMatch) {
            const parsedDate = new Date(dateMatch[1]);
            if (!isNaN(parsedDate.getTime())) {
                spentAt = parsedDate;
            }
        }

        // Extract description (first non-empty line or fallback)
        const lines = text.split('\n').filter((line) => line.trim().length > 0);
        const description = lines[0]?.trim() || 'OCR Scanned Receipt';

        // Try to detect category from keywords
        const category = this.detectCategory(text);

        return {
            amount,
            description,
            spentAt,
            category,
            confidence,
        };
    }

    private detectCategory(text: string): string | undefined {
        const lowerText = text.toLowerCase();

        const categories = [
            { keywords: ['food', 'restaurant', 'cafe', 'coffee', 'đồ ăn', 'nhà hàng', 'quán'], name: 'food' },
            { keywords: ['transport', 'taxi', 'grab', 'uber', 'xe'], name: 'transport' },
            { keywords: ['shopping', 'store', 'market', 'mua sắm', 'siêu thị'], name: 'shopping' },
            { keywords: ['health', 'hospital', 'pharmacy', 'y tế', 'bệnh viện'], name: 'health' },
            { keywords: ['entertainment', 'movie', 'cinema', 'giải trí'], name: 'entertainment' },
        ];

        for (const cat of categories) {
            if (cat.keywords.some((keyword) => lowerText.includes(keyword))) {
                return cat.name;
            }
        }

        return undefined;
    }

    private async emitOcrCompleted(
        jobId: string,
        userId: string,
        expenseData: ExpenseData,
        fileUrl: string,
    ): Promise<void> {
        const event: OcrCompletedEvent = {
            jobId,
            userId,
            expenseData,
            fileUrl,
        };

        this.logger.log(`Emitting ocr.completed event for job ${jobId}`);
        this.rabbitClient.emit('ocr.completed', event);
    }

    private async updateJobStatus(
        jobId: string,
        status: OcrJobStatus,
    ): Promise<void> {
        await this.prisma.ocrJob.update({
            where: { id: jobId },
            data: { status },
        });
    }
}
