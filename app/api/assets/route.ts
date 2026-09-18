import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assetSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { AssetDto } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const assets = await prisma.asset.findMany({
      where: {
        userId: user.id,
        isArchived: false,
      },
      orderBy: { createdAt: "desc" },
    });

    const result: AssetDto[] = assets.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      value: Number(a.value),
      liquidityTier: a.liquidityTier,
      lastValuationAt: a.lastValuationAt.toISOString(),
      isArchived: a.isArchived,
      createdAt: a.createdAt.toISOString(),
    }));

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/assets error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat daftar aset", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = assetSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input data aset tidak valid",
        400
      );
    }

    const { name, category, value, liquidityTier } = parsed.data;

    const asset = await prisma.asset.create({
      data: {
        userId: user.id,
        name,
        category,
        value,
        liquidityTier,
        lastValuationAt: new Date(),
        isArchived: false,
      },
    });

    const dto: AssetDto = {
      id: asset.id,
      name: asset.name,
      category: asset.category,
      value: Number(asset.value),
      liquidityTier: asset.liquidityTier,
      lastValuationAt: asset.lastValuationAt.toISOString(),
      isArchived: asset.isArchived,
      createdAt: asset.createdAt.toISOString(),
    };

    return apiSuccess(dto, 201);
  } catch (error) {
    console.error("POST /api/assets error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menambah aset", 500);
  }
}
