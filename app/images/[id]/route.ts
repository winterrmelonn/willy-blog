import dbConnect from "@/lib/mongoose";
import Image, { isImageId } from "@/lib/ImageModel";

// An uploaded image. Its id never points at anything else, so browsers can keep it for good.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    if (!isImageId(id)) return new Response("Not found", { status: 404 });
    await dbConnect();
    const image = await Image.findById(id).lean<{ data: { buffer: ArrayBuffer } | Buffer; type: string }>();
    if (!image) return new Response("Not found", { status: 404 });
    const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data.buffer);
    return new Response(new Uint8Array(data), {
        headers: { "Content-Type": image.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
}
