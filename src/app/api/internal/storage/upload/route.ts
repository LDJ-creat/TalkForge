import { jsonError } from "@/server/api/http";
import { writeStorageUpload } from "@/server/storage/internal-upload";
import { getStorageProvider } from "@/server/storage/provider";

export async function PUT(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return Response.json(
        { error: { code: "missing_upload_token", message: "Upload token is required." } },
        { status: 400 },
      );
    }

    const body = Buffer.from(await request.arrayBuffer());
    await writeStorageUpload(getStorageProvider(), token, body);
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}