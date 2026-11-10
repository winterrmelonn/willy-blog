import { Schema, deleteModel, model, models } from "mongoose";
import Post from "./PostModel";
import Project from "./ProjectModel";

// Cover images for blogs and projects, uploaded by admins. Kept in MongoDB (the site has no other file
// storage); each is shrunk in the browser first, so they stay small. Served by app/images/[id]/route.ts.
const ImageSchema = new Schema({ data: { type: Buffer, required: true }, type: { type: String, required: true } }, { timestamps: true });

if (process.env.NODE_ENV !== "production" && models.Image) deleteModel("Image"); // see PostModel.ts
const Image = models.Image || model("Image", ImageSchema);

export default Image;

export const isImageId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{24}$/.test(id);

// Delete an image once no post or project uses it, so replaced or abandoned uploads don't pile up in the database
export async function deleteUnusedImage(id: unknown) {
    if (!isImageId(id)) return;
    const [inPost, inProject] = await Promise.all([Post.exists({ image: id }), Project.exists({ image: id })]);
    if (!inPost && !inProject) await Image.deleteOne({ _id: id });
}
