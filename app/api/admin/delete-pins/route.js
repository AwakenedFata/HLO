import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import PinCode from "@/lib/models/pinCode";
import { authorizeRequest } from "@/lib/utils/auth-server";
import logger from "@/lib/utils/logger-server";
import { validateRequest, deletePinSchema } from "@/lib/utils/validation";

export async function POST(request) {
  try {
    await connectToDatabase();

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(
      request
    );
    if (authResult.error) {
      return NextResponse.json(
        { status: "error", message: authResult.message },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = await validateRequest(deletePinSchema, body);

    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 });
    }

    const { pinIds } = validation.data;

    logger.info(`Attempting to delete multiple pins: ${pinIds.length} pins`);

    // Check if all PINs exist and haven't been used
    const pins = await PinCode.find({ _id: { $in: pinIds } });

    if (pins.length !== pinIds.length) {
      return NextResponse.json(
        { error: "Beberapa PIN tidak ditemukan" },
        { status: 400 }
      );
    }

    // Check if any PINs have been used
    const usedPins = pins.filter((pin) => pin.used);
    if (usedPins.length > 0) {
      return NextResponse.json(
        {
          error: "Tidak dapat menghapus PIN yang sudah digunakan",
          usedPins: usedPins.map((p) => p.code),
        },
        { status: 400 }
      );
    }

    // Delete PINs
    const result = await PinCode.deleteMany({
      _id: { $in: pinIds },
      used: false,
    });

    logger.info(
      `${result.deletedCount} PIN dihapus oleh ${authResult.user.username}`
    );

    return NextResponse.json({
      success: true,
      message: `${result.deletedCount} PIN berhasil dihapus`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    logger.error("Error deleting pins:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
