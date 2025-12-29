import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScanOcrDto } from './dto/scan-ocr.dto';
import { QueryOcrDto } from './dto/query-ocr.dto';
import { Prisma } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { OcrWorkerService } from './ocr-worker.service';

@Injectable()
export class OcrsService {
  private readonly logger = new Logger(OcrsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject('RABBITMQ_CLIENT') private rabbitClient: ClientProxy,
    private ocrWorker: OcrWorkerService,
  ) { }

  async scan(
    scanOcrDto: ScanOcrDto,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const job = await this.prisma.ocrJob.create({
      data: {
        userId,
        fileUrl: scanOcrDto.fileUrl,
        status: 'queued',
      },
    });

    // Emit job to processing queue
    await this.emitJobToQueue(job.id);

    return this.transformJob(job);
  }

  async emitJobToQueue(jobId: string): Promise<void> {
    this.logger.log(`Emitting job ${jobId} to processing queue`);

    // Process job asynchronously (don't await to return response quickly)
    setImmediate(() => {
      this.ocrWorker.processOcrJob(jobId).catch((error) => {
        this.logger.error(
          `Failed to process job ${jobId}: ${error.message}`,
          error.stack,
        );
      });
    });
  }

  async updateJobStatus(
    jobId: string,
    status: string,
    resultJson?: any,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.ocrJob.update({
      where: { id: jobId },
      data: {
        status,
        ...(resultJson && { resultJson }),
        ...(errorMessage && { errorMessage }),
        ...(status === 'completed' || status === 'failed'
          ? { completedAt: new Date() }
          : {}),
      },
    });
  }

  async findHistory(
    query: QueryOcrDto,
    userId: string,
  ): Promise<{
    data: Record<string, unknown>[];
    meta: Record<string, unknown>;
  }> {
    const { status, page = 1, limit = 10 } = query;

    // Build where clause
    const where: Prisma.OcrJobWhereInput = {
      userId,
      ...(status && { status }),
    };

    // Execute queries in parallel
    const [jobs, total] = await Promise.all([
      this.prisma.ocrJob.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ocrJob.count({ where }),
    ]);

    return {
      data: jobs.map((job) => this.transformJob(job)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        timestamp: new Date().toISOString(),
      },
    };
  }

  async findOne(
    jobId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const job = await this.prisma.ocrJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`OCR job with ID ${jobId} not found`);
    }

    // Check ownership
    if (job.userId !== userId) {
      throw new ForbiddenException('You do not have access to this OCR job');
    }

    return this.transformJob(job);
  }

  private transformJob(
    job: Prisma.OcrJobGetPayload<object>,
  ): Record<string, unknown> {
    return {
      id: job.id,
      userId: job.userId,
      status: job.status,
      fileUrl: job.fileUrl,
      resultJson: job.resultJson,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || null,
    };
  }
}
