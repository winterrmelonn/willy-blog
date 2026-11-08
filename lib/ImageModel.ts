import { Schema, deleteModel, model, models } from "mongoose";

// Cover images for blogs and projects, uploaded by admins. Kept in MongoDB (the site has no other file
// storage); each is shrunk in the browser first, so they stay small. Served by app/images/[id]/route.ts.
const ImageSchema = new Schema({ data: { type: Buffer, required: true }, type: { type: String, required: true } }, { timestamps: true });

if (process.env.NODE_ENV !== "production" && models.Image) deleteModel("Image"); // see PostModel.ts
const Image = models.Image || model("Image", ImageSchema);

export default Image;

export const isImageId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{24}$/.test(id);
